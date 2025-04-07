use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse arguments - simple version
    let args: Vec<String> = env::args().collect();
    let fps = if args.len() > 1 {
        args[1].parse().unwrap_or(30) // Default to 30 fps if parsing fails
    } else {
        30 // Default fps
    };

    println!("Converting frames to video at {} fps", fps);

    // Find the latest render directory
    let root_dir = "./image_renders";
    let output_dir = "./rendered_videos";

    // Create output directory if it doesn't exist
    fs::create_dir_all(output_dir)?;

    // Find latest render directory
    let latest_dir = find_latest_dir(root_dir)?;
    let dir_name = latest_dir.file_name().unwrap().to_string_lossy();
    println!("Processing directory: {}", dir_name);

    // Get all frame files
    let frame_pattern = format!("{}/frame_%05d.png", latest_dir.display());
    let output_file = format!("{}/{}.mp4", output_dir, dir_name);

    // Use simple command-line ffmpeg instead of the library
    // This simplifies the code significantly but still works well
    let status = std::process::Command::new("ffmpeg")
        .arg("-y") // Overwrite output if it exists
        .arg("-framerate")
        .arg(fps.to_string())
        .arg("-i")
        .arg(frame_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("23") // Good quality/size balance
        .arg(&output_file)
        .status()?;

    if status.success() {
        println!("Video created successfully: {}", output_file);

        // Delete the render directory with all its PNG images
        fs::remove_dir_all(&latest_dir)?;
        println!("Deleted render folder: {}", latest_dir.display());
        Ok(())
    } else {
        Err("FFmpeg command failed".into())
    }
}

// Find the most recently created directory in the given path that starts with "render"
fn find_latest_dir(dir_path: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = Path::new(dir_path);

    if !path.exists() {
        return Err(format!("Directory not found: {}", dir_path).into());
    }

    let mut newest_dir = None;
    let mut newest_time = std::time::UNIX_EPOCH;

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with("render") {
                    if let Ok(metadata) = fs::metadata(&path) {
                        let time = metadata.created().or_else(|_| metadata.modified())?;

                        if time > newest_time {
                            newest_time = time;
                            newest_dir = Some(path);
                        }
                    }
                }
            }
        }
    }

    newest_dir.ok_or_else(|| "No render directories found".into())
}
