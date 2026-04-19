cmake_minimum_required(VERSION 3.27.0)
project(SmartSpectraLiveVitals CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(SmartSpectra REQUIRED)
find_package(OpenCV REQUIRED)

add_executable(live_vitals live_vitals.cpp)

target_link_libraries(live_vitals
    SmartSpectra::Container
    ${OpenCV_LIBS}
)
