#!/bin/bash
set -e

echo "========================================"
echo "    Presage SDK Setup & Custom Build    "
echo "========================================"

# 0. Check for Ubuntu version
distro=$(lsb_release -sc)
if [ "$distro" != "jammy" ]; then
    echo "ERROR: This SDK requires Ubuntu 22.04 (jammy). You are currently on $distro."
    echo "Please run this script inside the Ubuntu-22.04 distribution."
    exit 1
fi

# 1. Update and install repository prerequisites
echo "\n[1/5] Enabling repositories and installing Prerequisites..."
sudo add-apt-repository -y universe
sudo add-apt-repository -y multiverse
sudo apt update
sudo apt install -y gpg curl

# 2. Add Presage Debian Repository
echo "\n[2/5] Setting up the Presage Technology Repository..."
curl -s "https://presage-security.github.io/PPA/KEY.gpg" | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/presage-technologies.gpg >/dev/null
sudo curl -s --compressed -o /etc/apt/sources.list.d/presage-technologies.list "https://presage-security.github.io/PPA/presage-technologies.list"

# 3. Complete Build Tools and SDK installation
echo "\n[3/5] Installing Build Tools and the SmartSpectra SDK..."
sudo apt update
sudo apt install -y build-essential git lsb-release libcurl4-openssl-dev libssl-dev pkg-config libv4l-dev libgles2-mesa-dev libunwind-dev libsmartspectra-dev libopencv-dev libgoogle-glog-dev

# Install CMake 3.27.0 manually
# Downloading to /tmp to avoid permission issues on Windows-mounted partition (/mnt/c)
curl -L -o /tmp/cmake-3.27.0-linux-x86_64.sh https://github.com/Kitware/CMake/releases/download/v3.27.0/cmake-3.27.0-linux-x86_64.sh
chmod +x /tmp/cmake-3.27.0-linux-x86_64.sh
sudo /tmp/cmake-3.27.0-linux-x86_64.sh --skip-license --prefix=/usr/local
rm /tmp/cmake-3.27.0-linux-x86_64.sh

# 4. Compile the custom C++ Application (Using native Linux partition for build)
echo "\n[4/5] Preparing build in native Linux filesystem (~/presage-build)..."
BUILD_DIR="$HOME/presage-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy source to native directory
cp live_vitals.cpp CMakeLists.txt "$BUILD_DIR/"

# Move to native directory and build
cd "$BUILD_DIR"
echo "Running CMake with OpenCV hints..."
# We force the OpenCV_DIR to the one found via research to ensure 4.10.0 is used
cmake -DOpenCV_DIR=/usr/lib/x86_64-linux-gnu/cmake/opencv4 .
make

# Copy the finished executable back to the Windows directory
echo "Copying binary back to your Windows folder..."
cp live_vitals "/mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/presage-companion/"

echo "\n[5/5] Success! Everything is installed and built."
echo "The 'live_vitals' binary is now ready in your Windows folder."
echo "To run it on your video:"
echo "./live_vitals Rk6utQ7KXi5RnKdhewgJW74ZvTkQvbW25m6LRqHm /mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/IMG_6038.mp4 /mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/vitals.json"
