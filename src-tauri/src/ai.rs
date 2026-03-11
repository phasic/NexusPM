//! Embedded AI: model download-on-first-run and local inference via llama-gguf.

use llama_gguf::engine::{Engine, EngineConfig};
use llama_gguf::huggingface::HfClient;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};

const HF_REPO: &str = "bartowski/Qwen2.5-Coder-14B-GGUF";
const HF_FILENAME: &str = "Qwen2.5-Coder-14B-Q4_K_M.gguf";
const HF_URL: &str = "https://huggingface.co/bartowski/Qwen2.5-Coder-14B-GGUF/resolve/main/Qwen2.5-Coder-14B-Q4_K_M.gguf";
const PROGRESS_EMIT_INTERVAL_MS: u64 = 300;

pub struct AiState {
    pub engine: Mutex<Option<Arc<Engine>>>,
    pub model_path: Mutex<Option<PathBuf>>,
    pub download_in_progress: Arc<AtomicBool>,
    pub download_cancel_requested: Arc<AtomicBool>,
    pub download_delete_on_cancel: Arc<AtomicBool>,
}

impl Default for AiState {
    fn default() -> Self {
        Self {
            engine: Mutex::new(None),
            model_path: Mutex::new(None),
            download_in_progress: Arc::new(AtomicBool::new(false)),
            download_cancel_requested: Arc::new(AtomicBool::new(false)),
            download_delete_on_cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn get_model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())
        .map(|p: PathBuf| p.join("models"))
}

fn download_with_progress_inner(
    app: &AppHandle,
    cancel_flag: Option<&Arc<AtomicBool>>,
    delete_on_cancel: Option<&Arc<AtomicBool>>,
    start_from: u64,
) -> Result<PathBuf, String> {
    let model_dir = get_model_dir(app)?;
    std::fs::create_dir_all(&model_dir).map_err(|e| e.to_string())?;

    let cached_path = {
        let hf = HfClient::with_cache_dir(model_dir);
        if hf.is_cached(HF_REPO, HF_FILENAME) {
            return Ok(hf.get_cached_path(HF_REPO, HF_FILENAME));
        }
        hf.get_cached_path(HF_REPO, HF_FILENAME)
    };

    let cancellable = cancel_flag.is_some();
    let _ = app.emit("ai:download-started", serde_json::json!({ "cancellable": cancellable }));

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| format!("HTTP client: {e}"))?;

    let mut request = client.get(HF_URL);
    if start_from > 0 {
        request = request.header("Range", format!("bytes={}-", start_from));
    }
    let mut response = request.send().map_err(|e| format!("Download request: {e}"))?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!(
            "HTTP {}: {}",
            response.status(),
            response.text().unwrap_or_default()
        ));
    }

    let total_size = if start_from > 0 {
        response
            .headers()
            .get("Content-Range")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split('/').nth(1))
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
    } else {
        response.content_length().unwrap_or(0)
    };

    let temp_path = cached_path.with_extension("tmp");
    let mut file = if start_from > 0 {
        OpenOptions::new()
            .write(true)
            .append(true)
            .open(&temp_path)
            .map_err(|e| format!("Open partial file: {e}"))?
    } else {
        std::fs::File::create(&temp_path).map_err(|e| format!("Create file: {e}"))?
    };

    let mut downloaded: u64 = start_from;
    let mut last_emit = Instant::now();
    let mut buf = [0u8; 65536];

    loop {
        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::SeqCst) {
                drop(file);
                let do_delete = delete_on_cancel.map(|d| d.load(Ordering::SeqCst)).unwrap_or(true);
                if do_delete {
                    let _ = std::fs::remove_file(&temp_path);
                    let _ = app.emit("ai:download-cancelled", ());
                } else {
                    let _ = app.emit(
                        "ai:download-paused",
                        serde_json::json!({ "downloaded": downloaded, "total": total_size }),
                    );
                }
                return Err("cancelled".to_string());
            }
        }

        let n = std::io::Read::read(&mut response, &mut buf).map_err(|e| format!("Read: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| format!("Write: {e}"))?;
        downloaded += n as u64;

        if last_emit.elapsed().as_millis() >= PROGRESS_EMIT_INTERVAL_MS as u128 {
            let _ = app.emit(
                "ai:download-progress",
                serde_json::json!({ "downloaded": downloaded, "total": total_size }),
            );
            last_emit = Instant::now();
        }
    }

    let _ = app.emit(
        "ai:download-progress",
        serde_json::json!({ "downloaded": downloaded, "total": total_size }),
    );
    std::fs::rename(&temp_path, &cached_path).map_err(|e| format!("Rename: {e}"))?;
    let _ = app.emit("ai:download-complete", ());
    Ok(cached_path)
}

fn download_with_progress(app: &AppHandle) -> Result<PathBuf, String> {
    download_with_progress_inner(app, None, None, 0)
}

fn ensure_model_downloaded(app: &AppHandle) -> Result<PathBuf, String> {
    download_with_progress(app)
}

fn ensure_engine_loaded(app: &AppHandle, state: &AiState) -> Result<Arc<Engine>, String> {
    {
        let guard = state.engine.lock().map_err(|e| e.to_string())?;
        if let Some(ref engine) = *guard {
            return Ok(Arc::clone(engine));
        }
    }

    let model_path = {
        let mut path_guard = state.model_path.lock().map_err(|e| e.to_string())?;
        if path_guard.is_none() {
            *path_guard = Some(ensure_model_downloaded(app)?);
        }
        path_guard.as_ref().unwrap().clone()
    };

    let _ = app.emit("ai:load-started", ());

    let config = EngineConfig {
        model_path: model_path.to_string_lossy().into_owned(),
        tokenizer_path: None,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.1,
        max_tokens: 2048,
        seed: None,
        use_gpu: false,
        max_context_len: Some(8192),
    };

    let engine = Engine::load(config).map_err(|e| format!("Load failed: {e}"))?;
    let engine = Arc::new(engine);

    {
        let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
        *guard = Some(Arc::clone(&engine));
    }

    let _ = app.emit("ai:load-complete", ());
    Ok(engine)
}

#[derive(serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn chat_completion(
    app: AppHandle,
    state: State<'_, AiState>,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    let engine = ensure_engine_loaded(&app, &state)?;

    let (system, user) = {
        let mut system = String::new();
        let mut user = String::new();
        for m in &messages {
            match m.role.as_str() {
                "system" => system = m.content.clone(),
                "user" => user = m.content.clone(),
                _ => {}
            }
        }
        (system, user)
    };

    let prompt = if system.is_empty() {
        user
    } else {
        format!("{system}\n\n{user}")
    };

    let _ = app.emit("ai:processing", ());

    let result = tauri::async_runtime::spawn_blocking(move || {
        engine.generate(&prompt, 2048).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result.trim().to_string())
}

/// Download the AI model from Hugging Face if not already cached.
/// Returns "already_cached" if the model exists, "downloaded" if it was just downloaded.
#[tauri::command]
pub async fn download_ai_model(app: AppHandle) -> Result<String, String> {
    let model_dir = get_model_dir(&app)?;
    std::fs::create_dir_all(&model_dir).map_err(|e| e.to_string())?;

    let hf = HfClient::with_cache_dir(model_dir);
    if hf.is_cached(HF_REPO, HF_FILENAME) {
        return Ok("already_cached".to_string());
    }

    download_with_progress(&app).map(|_| "downloaded".to_string())
}

/// Start downloading the AI model in the background. Call on app launch.
/// Returns "cached" | "started" | "already_started".
#[tauri::command]
pub async fn start_background_download(
    app: AppHandle,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let model_dir = get_model_dir(&app)?;
    std::fs::create_dir_all(&model_dir).map_err(|e| e.to_string())?;

    let hf = HfClient::with_cache_dir(model_dir);
    if hf.is_cached(HF_REPO, HF_FILENAME) {
        return Ok("cached".to_string());
    }

    let download_flag = Arc::clone(&state.download_in_progress);
    let cancel_flag = Arc::clone(&state.download_cancel_requested);
    let delete_on_cancel = Arc::clone(&state.download_delete_on_cancel);

    if download_flag
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok("already_started".to_string());
    }

    cancel_flag.store(false, Ordering::SeqCst);
    delete_on_cancel.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn_blocking(move || {
        let result =
            download_with_progress_inner(&app, Some(&cancel_flag), Some(&delete_on_cancel), 0);
        download_flag.store(false, Ordering::SeqCst);
        if let Err(e) = result {
            if e != "cancelled" {
                let _ = app.emit("ai:download-error", e);
            }
        }
    });

    Ok("started".to_string())
}

/// Resume a paused download from the partial file.
#[tauri::command]
pub async fn resume_background_download(
    app: AppHandle,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let model_dir = get_model_dir(&app)?;
    let hf = HfClient::with_cache_dir(model_dir);
    if hf.is_cached(HF_REPO, HF_FILENAME) {
        return Ok("cached".to_string());
    }

    let cached_path = hf.get_cached_path(HF_REPO, HF_FILENAME);
    let temp_path = cached_path.with_extension("tmp");
    let start_from = std::fs::metadata(&temp_path)
        .ok()
        .map(|m| m.len())
        .unwrap_or(0);

    if start_from == 0 {
        return start_background_download(app, state).await;
    }

    let download_flag = Arc::clone(&state.download_in_progress);
    let cancel_flag = Arc::clone(&state.download_cancel_requested);
    let delete_on_cancel = Arc::clone(&state.download_delete_on_cancel);

    if download_flag
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok("already_started".to_string());
    }

    cancel_flag.store(false, Ordering::SeqCst);
    delete_on_cancel.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn_blocking(move || {
        let result = download_with_progress_inner(
            &app,
            Some(&cancel_flag),
            Some(&delete_on_cancel),
            start_from,
        );
        download_flag.store(false, Ordering::SeqCst);
        if let Err(e) = result {
            if e != "cancelled" {
                let _ = app.emit("ai:download-error", e);
            }
        }
    });

    Ok("started".to_string())
}

/// Request cancellation of the in-progress download.
/// delete_partial: true = stop and delete partial file, false = pause and keep partial file.
#[tauri::command]
pub async fn request_download_cancel(
    state: State<'_, AiState>,
    delete_partial: bool,
) -> Result<(), String> {
    if !state.download_in_progress.load(Ordering::SeqCst) {
        return Ok(());
    }
    state.download_cancel_requested.store(true, Ordering::SeqCst);
    state.download_delete_on_cancel.store(delete_partial, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn ai_model_status(state: State<'_, AiState>) -> Result<String, String> {
    let guard = state.engine.lock().map_err(|e| e.to_string())?;
    Ok(if guard.is_some() {
        "loaded".to_string()
    } else {
        "not_loaded".to_string()
    })
}
