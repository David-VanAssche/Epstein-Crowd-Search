# Cloud VM Setup Guide

Google Cloud e2-medium for Phases 3-4.

## Provision

```bash
gcloud compute instances create epstein-uploader \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
  --create-disk=size=150GB,type=pd-ssd,name=epstein-temp,auto-delete=yes \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

**Specs:** 2 vCPU, 4GB RAM, 20GB boot + 150GB SSD
**Cost:** ~$0.82/day VM + ~$1.50/day SSD = ~$2.32/day

## SSH + Setup

```bash
# SSH in
gcloud compute ssh epstein-uploader --zone=us-central1-a

# Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git aria2

# Mount SSD for torrent temp storage
sudo mkfs.ext4 /dev/sdb
sudo mkdir /mnt/temp
sudo mount /dev/sdb /mnt/temp
sudo chown $USER:$USER /mnt/temp

# Clone repo + setup
git clone https://github.com/YOUR_USERNAME/EpsteinCrowdResearch.git
cd EpsteinCrowdResearch
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements-uploader.txt

# Create .env
cat > .env << 'EOF'
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here
EOF
```

## Run in Background

```bash
sudo apt install -y tmux
tmux new -s uploader
# Run upload commands inside tmux
# Detach: Ctrl+B, D
# Reattach: tmux attach -t uploader
```

## Teardown

```bash
# From local machine
gcloud compute instances delete epstein-uploader --zone=us-central1-a
```
