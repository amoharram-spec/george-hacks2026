#include <smartspectra/container/foreground_container.hpp>
#include <smartspectra/container/settings.hpp>
#include <physiology/modules/messages/metrics.h>
#include <physiology/modules/messages/status.h>
#include <glog/logging.h>
#include <opencv2/opencv.hpp>
#include <iostream>
#include <fstream>
#include <chrono>
#include <string>

using namespace presage::smartspectra;

// Helper to write vitals to JSON file
void write_vitals_to_file(const std::string& filepath, float pulse, float breathing) {
    std::ofstream f(filepath, std::ios::trunc);
    if (f.is_open()) {
        auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();
        
        f << "{\n"
          << "  \"pulse\": " << pulse << ",\n"
          << "  \"breathing\": " << breathing << ",\n"
          << "  \"timestamp\": " << now << "\n"
          << "}\n";
        f.flush();
    }
}

int main(int argc, char** argv) {
    google::InitGoogleLogging(argv[0]);
    FLAGS_alsologtostderr = true;
    
    std::string api_key;
    std::string video_path;
    std::string output_file = "../vitals.json"; // Default
    
    if (argc >= 3) {
        api_key = argv[1];
        video_path = argv[2];
        if (argc >= 4) {
            output_file = argv[3];
        }
    } else {
        std::cout << "Usage: ./live_vitals YOUR_API_KEY /path/to/video.mp4 [output_path]\n";
        return 1;
    }
    
    std::cout << "Starting Headless Presage Companion...\n";
    std::cout << "Writing vitals to: " << output_file << "\n";
    
    try {
        container::settings::Settings<
            container::settings::OperationMode::Continuous,
            container::settings::IntegrationMode::Rest
        > settings;
        
        settings.video_source.device_index = -1; // Disable live webcam
        settings.video_source.input_video_path = video_path; // Use recorded video file
        settings.video_source.capture_width_px = 1280;
        settings.video_source.capture_height_px = 720;
        settings.video_source.codec = presage::camera::CaptureCodec::MJPG;
        settings.video_source.auto_lock = true;
        
        // We run in "headless" mode so we don't need a UI window
        settings.headless = true;
        settings.enable_edge_metrics = true;
        settings.verbosity_level = 1;
        settings.continuous.preprocessed_data_buffer_duration_s = 0.5;
        settings.integration.api_key = api_key;
        
        auto container = std::make_unique<container::CpuContinuousRestForegroundContainer>(settings);
        
        // Output callback -> Write to JSON
        auto status = container->SetOnCoreMetricsOutput(
            [&output_file](const presage::physiology::MetricsBuffer& metrics, int64_t timestamp) {
                float pulse = 0;
                float breathing = 0;
                
                if (!metrics.pulse().rate().empty()){
                    pulse = metrics.pulse().rate().rbegin()->value();
                }
                if (!metrics.breathing().rate().empty()){
                    breathing = metrics.breathing().rate().rbegin()->value();
                }
                
                if (pulse > 0 || breathing > 0){
                    write_vitals_to_file(output_file, pulse, breathing);
                    std::cout << "Heartbeat: " << pulse << " BPM | Respiration: " << breathing << " RPM\n";
                }
                return absl::OkStatus();
            }
        ); 
        
        if (!status.ok()) {
            std::cerr << "Failed to set callback: " << status.message() << "\n";
            return 1;
        }
        
        std::cout << "Initializing Presage engine...\n";
        if (auto s = container->Initialize(); !s.ok()) {
            std::cerr << "Failed to init: " << s.message() << "\n";
            return 1;
        }
        
        std::cout << "Running! (Press Ctrl+C to stop)\n";
        if (auto s = container->Run(); !s.ok()) {
            std::cerr << "Engine stopped: " << s.message() << "\n";
            return 1;
        }
        
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }
}
