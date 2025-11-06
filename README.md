# Prayer Call App

A Python backend with React frontend application for scheduling and playing adhan (prayer call) on Chromecast devices.

## Features

- Select mosque from Mawaqit API
- Discover and select Chromecast devices on local network
- Upload and manage adhan MP3 files for each prayer
- Automatically schedule adhan prayers using cron jobs
- Play adhan on selected Chromecast at prayer times

## Prerequisites

- Python 3.7+
- Node.js 14+ and npm
- Chromecast device on the same local network
- Access to Mawaqit API (may require API key - see note below)

## Quick Start

### Option 1: Using the startup script

```bash
./start.sh
```

This will:

1. Set up Python virtual environment
2. Install all dependencies
3. Start the backend on port 3001
4. Start the frontend on port 3000

### Option 2: Manual setup

#### Backend Setup

1. Create and activate virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Create uploads directory:

```bash
mkdir uploads
```

4. Run the backend:

```bash
python -m backend.app
```

The backend will run on `http://localhost:3001` (accessible on your local network)

#### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the frontend:

```bash
npm start
```

The frontend will run on `http://localhost:3000`

### Option 3: Docker Deployment

#### Using Docker Compose

1. Build and run with Docker Compose:

```bash
docker-compose up -d
```

The app will be available at `http://localhost:3001`

2. View logs:

```bash
docker-compose logs -f
```

3. Stop the app:

```bash
docker-compose down
```

#### Using Docker directly

1. Build the Docker image:

```bash
docker build -t prayer-call:latest .
```

Or use the Makefile:

```bash
make docker-build
```

2. Run the container:

```bash
docker run -p 3001:3001 \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/uploads:/app/uploads \
  prayer-call:latest
```

Or use the Makefile:

```bash
make docker-run
```

### Option 4: Kubernetes Deployment

See the [Kubernetes Deployment Guide](k8s/README.md) for detailed instructions.

Quick start:

```bash
# Build and push image (if using remote registry)
make build-push

# Deploy to Kubernetes
make k8s-deploy

# Port forward to access locally
make k8s-port-forward
```

## Usage

1. **Select Mosque**: Go to the "Mosque" tab and search for your mosque using the Mawaqit API
2. **Select Chromecast**: Go to the "Chromecast" tab and scan for devices on your network
3. **Upload Adhan Files**: Go to the "Adhan Files" tab to upload MP3 files and assign them to each prayer
4. **View Schedule**: Go to the "Schedule" tab to see prayer times and verify cron jobs are scheduled

## Configuration

The app uses `config.json` to store:

- Selected mosque information
- Selected Chromecast device
- Adhan MP3 file paths for each prayer (fajr, dhuhr, asr, maghrib, isha)
- Prayer times schedule

## Important Notes

### Mawaqit API

The Mawaqit API may require authentication or may not be publicly accessible. If you encounter issues:

- Contact Mawaqit support for API access
- You may need to modify `mawaqit_client.py` to add API keys or use alternative endpoints

### Cron Jobs

The app creates cron jobs that run daily at prayer times. These jobs:

- Run the `backend.scripts.play_adhan` script
- Require the Flask backend to be running (or accessible) when the cron job executes
- Use the system's cron daemon (requires appropriate permissions)

### Network Access

To access the app from other devices on your local network:

- The backend runs on `0.0.0.0:3001` by default, making it accessible on your local network
- Access it via `http://<your-computer-ip>:3001` from other devices
- The frontend proxy is configured for `localhost:3001` - you may need to update it for network access

## Troubleshooting

### Chromecast not found

- Ensure Chromecast is on the same network
- Check firewall settings
- Try increasing the scan timeout

### Adhan not playing

- Verify the Flask backend is running
- Check that the MP3 file is accessible via HTTP
- Ensure Chromecast is powered on and connected

### Cron jobs not working

- Verify cron service is running: `systemctl status cron` (Linux) or check cron daemon
- Check cron logs for errors
- Ensure Python path in cron job is correct
- **In Kubernetes**: Use Kubernetes CronJobs instead of system cron (see `k8s/cronjob.yaml`)

## Versioning

The app uses semantic versioning. The current version is stored in the `VERSION` file.

### Updating the Version

1. Update the `VERSION` file with the new version (e.g., `1.0.1`)
2. Commit and push the changes
3. (Optional) Create a git tag for the version:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

### Docker Image Tags

When pushing to GitHub Container Registry, images are tagged with:

- `latest` - Latest build from main branch
- `<version>` - Version from VERSION file (e.g., `1.0.0`)
- `<short-sha>` - Short commit SHA (e.g., `a1b2c3d`)
- `<tag-version>` - If a version tag is pushed (e.g., `v1.0.1` creates tag `1.0.1`)

## Docker & Kubernetes

### Building the Docker Image

The Dockerfile uses a multi-stage build:

1. Builds the React frontend
2. Packages everything into a single Python image

```bash
docker build -t prayer-call:latest .
```

### GitHub Container Registry

The app automatically builds and pushes Docker images to GitHub Container Registry (ghcr.io) on:

- Pushes to the `main` branch
- Version tag pushes (e.g., `v1.0.0`)

Images are available at: `ghcr.io/<your-username>/<repo-name>:<tag>`

To pull and use the image:

```bash
docker pull ghcr.io/<your-username>/<repo-name>:latest
docker run -p 3001:3001 \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/uploads:/app/uploads \
  ghcr.io/<your-username>/<repo-name>:latest
```

### Kubernetes Deployment

The app includes complete Kubernetes manifests in the `k8s/` directory:

- **Namespace**: Isolates the application
- **ConfigMap**: Stores initial configuration
- **PVC**: Persistent storage for uploads
- **Deployment**: Main application
- **Service**: Exposes the app within the cluster
- **Ingress**: Optional external access
- **CronJob**: Optional Kubernetes-based scheduling

For detailed Kubernetes deployment instructions, see [k8s/README.md](k8s/README.md).

### Important Notes for Containerized Deployments

1. **Chromecast Discovery**: The app needs network access to discover Chromecast devices. Ensure your container/pod has appropriate network permissions.

2. **Cron Jobs**:

   - In Docker: System cron may not work reliably. Consider using an external scheduler or Kubernetes CronJobs.
   - In Kubernetes: Use Kubernetes CronJobs (see `k8s/cronjob.yaml`) instead of system cron.

3. **Persistent Storage**: Uploads and configuration are stored in volumes. Make sure volumes are properly mounted and have write permissions.

4. **Health Checks**: The deployment includes liveness and readiness probes. Adjust timeouts if needed.
