mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ai::AiState::default())
    .invoke_handler(tauri::generate_handler![
      ai::chat_completion,
      ai::ai_model_status,
      ai::download_ai_model,
      ai::start_background_download,
      ai::request_download_cancel,
      ai::resume_background_download,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
