# MindSpace - Student Wellness App

## How to Create a Shareable Link

### Option 1: Using ngrok (Recommended)

1. **Download ngrok:**
   - Go to https://ngrok.com/download
   - Download the Windows version
   - Extract the zip file

2. **Run your Flask app:**
   ```bash
   python app.py
   ```
   (It should be running on http://127.0.0.1:5000)

3. **Start ngrok in a new terminal:**
   ```bash
   ngrok http 5000
   ```

4. **Get your public URL:**
   - ngrok will display a URL like: `https://abc123.ngrok-free.app`
   - Share this URL with anyone!
   - They can access your app from anywhere

### Option 2: Using localtunnel (Alternative)

1. **Install localtunnel:**
   ```bash
   npm install -g localtunnel
   ```

2. **Run your Flask app:**
   ```bash
   python app.py
   ```

3. **Start localtunnel:**
   ```bash
   lt --port 5000
   ```

4. **Share the generated URL**

## Important Notes

- **Temporary Links:** Both ngrok and localtunnel URLs are temporary and will expire when you close them
- **Security:** Your Gemini API key is visible in the code. For production, move it to environment variables
- **Free Tier:** ngrok free tier has limitations (session time, requests per minute)

## Running Locally

```bash
python app.py
```

Then visit: http://127.0.0.1:5000
