document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-stream');
    const cameraSelect = document.getElementById('camera-select');
    const templateBtns = document.querySelectorAll('.template-btn');
    const btnPhoto = document.getElementById('btn-photo');
    const btnVideo = document.getElementById('btn-video');
    const flashEffect = document.getElementById('flash-effect');
    const resultModal = document.getElementById('result-modal');
    const closeModal = document.getElementById('close-modal');
    const resultContainer = document.getElementById('result-container');
    const btnDownload = document.getElementById('btn-download');
    const captureCanvas = document.getElementById('capture-canvas');
    const qrContainer = document.getElementById('qrcode');
    const ctx = captureCanvas.getContext('2d');
    
    // New Elements
    const overlayUpload = document.getElementById('overlay-upload');
    const settingSlowmo = document.getElementById('setting-slowmo');
    const formatSelect = document.getElementById('format-select');
    const boothContainer = document.getElementById('booth-container');
    const settingMirror = document.getElementById('setting-mirror');
    const settingRotation = document.getElementById('setting-rotation');

    let currentStream = null;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let currentPhotoTemplate = 'template-none';
    let currentVideoTemplate = 'template-none';
    let animationFrameId = null;

    // 1. Initialize Camera
    async function initCamera(deviceId = null) {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
            audio: false // No audio needed for photobooth, but might need for video
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            currentStream = stream;
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                video.play();
                startPreviewLoop(); // Start continuous canvas drawing!
            };

            // Populate devices only on first load
            if (!deviceId) {
                await populateCameras();
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin akses kamera.');
        }
    }

    // Canvas Live Preview & Rendering Loop
    function startPreviewLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        function drawFrame() {
            if (!currentStream || !video.videoWidth) {
                animationFrameId = requestAnimationFrame(drawFrame);
                return;
            }

            // Determine target canvas size based on format
            let targetWidth = 1920;
            let targetHeight = 1080;
            if (currentFormat === 'portrait') {
                targetWidth = 1080;
                targetHeight = 1920;
            } else if (currentFormat === 'square') {
                targetWidth = 1080;
                targetHeight = 1080;
            }
            captureCanvas.width = targetWidth;
            captureCanvas.height = targetHeight;

            // Get rotation and mirror
            const isMirrored = settingMirror.checked;
            const rotation = parseInt(settingRotation.value) || 0;

            // Effective source dimensions after physical rotation
            let srcWidth = video.videoWidth;
            let srcHeight = video.videoHeight;
            if (rotation === 90 || rotation === 270) {
                srcWidth = video.videoHeight;
                srcHeight = video.videoWidth;
            }

            // Calculate scale to cover the target dimensions completely
            const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);

            ctx.save();
            // Move to center of canvas
            ctx.translate(targetWidth / 2, targetHeight / 2);
            
            // Apply Mirror
            if (isMirrored) ctx.scale(-1, 1);
            
            // Apply Rotation
            ctx.rotate(rotation * Math.PI / 180);

            // Draw Video centered
            // The drawing coordinate system is now rotated, so we draw using ORIGINAL video dimensions!
            // Scaling ensures it fills the canvas.
            ctx.scale(scale, scale);
            ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight);
            
            ctx.restore();

            // Active template based on whether recording is active
            const activeTemplate = isRecording ? currentVideoTemplate : currentPhotoTemplate;
            const activeCustomImage = isRecording ? window.customVideoOverlay : window.customPhotoOverlay;

            // Draw template overlay over the video on the canvas
            if (activeTemplate === 'template-neon') {
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 40;
                ctx.strokeRect(0, 0, captureCanvas.width, captureCanvas.height);
            } else if (activeTemplate === 'template-cinema') {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, captureCanvas.width, 150);
                ctx.fillRect(0, captureCanvas.height - 150, captureCanvas.width, 150);
            } else if (activeTemplate === 'template-floral') {
                ctx.strokeStyle = '#ff007f';
                ctx.lineWidth = 40;
                ctx.strokeRect(0, 0, captureCanvas.width, captureCanvas.height);
            } else if (activeTemplate === 'template-custom' && activeCustomImage) {
                ctx.drawImage(activeCustomImage, 0, 0, captureCanvas.width, captureCanvas.height);
            }

            animationFrameId = requestAnimationFrame(drawFrame);
        }
        drawFrame();
    }

    // Format Selection
    let currentFormat = 'landscape';
    boothContainer.classList.add('ratio-landscape');

    formatSelect.addEventListener('change', (e) => {
        currentFormat = e.target.value;
        boothContainer.className = `booth-container ratio-${currentFormat}`;
    });

    // 2. Populate Camera Select
    async function populateCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Kamera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Error enumerating devices:', err);
        }
    }

    cameraSelect.addEventListener('change', (e) => {
        initCamera(e.target.value);
    });

    // 3. Photo Templates Selection
    document.querySelectorAll('.photo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.photo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPhotoTemplate = e.target.dataset.template;
        });
    });

    // 3.5 Video Templates Selection
    document.querySelectorAll('.video-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.video-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentVideoTemplate = e.target.dataset.template;
        });
    });

    // 4. Custom Photo Overlay Upload
    const photoOverlayUpload = document.getElementById('photo-overlay-upload');
    if (photoOverlayUpload) {
        photoOverlayUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgDataUrl = event.target.result;
                    document.querySelectorAll('.photo-btn').forEach(b => b.classList.remove('active'));
                    currentPhotoTemplate = 'template-custom';
                    
                    window.customPhotoOverlay = new Image();
                    window.customPhotoOverlay.src = imgDataUrl;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4.5 Custom Video Overlay Upload
    const videoOverlayUpload = document.getElementById('video-overlay-upload');
    if (videoOverlayUpload) {
        videoOverlayUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgDataUrl = event.target.result;
                    document.querySelectorAll('.video-btn').forEach(b => b.classList.remove('active'));
                    currentVideoTemplate = 'template-custom';
                    
                    window.customVideoOverlay = new Image();
                    window.customVideoOverlay.src = imgDataUrl;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. Capture Photo
    btnPhoto.addEventListener('click', () => {
        // Flash effect
        flashEffect.classList.add('active');
        setTimeout(() => flashEffect.classList.remove('active'), 150);

        // Result is already drawn continuously on captureCanvas, so we just grab it!
        // Show Result
        const dataUrl = captureCanvas.toDataURL('image/png');
        resultContainer.innerHTML = `<img src="${dataUrl}" alt="Captured Photo">`;
        btnDownload.href = dataUrl;
        btnDownload.download = `photobooth_${Date.now()}.png`;
        
        resultModal.classList.remove('hidden');

        // Generate QR via Cloud Upload
        captureCanvas.toBlob((blob) => {
            uploadToCloudAndGenerateQR(blob, `photobooth_${Date.now()}.png`);
        }, 'image/png');
    });

    // 5. Record Video
    let recordingTimeout = null;

    btnVideo.addEventListener('click', () => {
        if (!isRecording) {
            isRecording = true;
            // Start recording
            startRecording();
            
            btnVideo.textContent = '⏹️ Berhenti (Otomatis 15s)';
            btnVideo.classList.replace('btn-danger', 'btn-primary');

            // Auto-stop
            recordingTimeout = setTimeout(() => {
                if (isRecording) {
                    isRecording = false;
                    stopRecording();
                    btnVideo.textContent = '🎥 Rekam Video';
                    btnVideo.classList.replace('btn-primary', 'btn-danger');
                }
            }, 15000);

        } else {
            isRecording = false;
            // Stop recording manually
            stopRecording();
            if (recordingTimeout) clearTimeout(recordingTimeout);
            
            btnVideo.textContent = '🎥 Rekam Video';
            btnVideo.classList.replace('btn-primary', 'btn-danger');
        }
    });

    function startRecording() {
        recordedChunks = [];
        try {
            // Record from the continuously updating canvas preview stream!
            const canvasStream = captureCanvas.captureStream(30);
            mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
        } catch (e) {
            console.error('MediaRecorder error:', e);
            // Fallback to original stream if canvas capture fails
            mediaRecorder = new MediaRecorder(currentStream);
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const rawBlob = new Blob(recordedChunks, { type: 'video/webm' });
            showFinalVideo(rawBlob);
        };

        mediaRecorder.start();
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    function showFinalVideo(blob) {
        const url = URL.createObjectURL(blob);
        const videoElem = document.createElement('video');
        videoElem.src = url;
        videoElem.controls = true;
        videoElem.autoplay = true;
        videoElem.loop = true;
        
        resultContainer.innerHTML = '';
        resultContainer.appendChild(videoElem);
        
        btnDownload.href = url;
        btnDownload.download = `video360_${Date.now()}.webm`;
        
        resultModal.classList.remove('hidden');

        // Generate QR via Cloud Upload
        uploadToCloudAndGenerateQR(blob, `video360_${Date.now()}.webm`);
    }

    // Upload to Cloud to generate a working QR for static sites
    async function uploadToCloudAndGenerateQR(blob, filename) {
        qrContainer.innerHTML = '<p class="qr-text" style="color: black;">Mengunggah ke internet...</p>';
        
        try {
            const formData = new FormData();
            formData.append('file', blob, filename);
            
            // Menggunakan tmpfiles.org (gratis, tanpa limit ketat, file otomatis hapus 60 menit)
            const response = await fetch('https://tmpfiles.org/api/v1/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Konversi URL halaman menjadi URL direct download
                const dlUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: dlUrl,
                    width: 150,
                    height: 150,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.M
                });
                
                // Add a note about one-time use
                const note = document.createElement('p');
                note.style.fontSize = '0.8rem';
                note.style.color = '#ff3333';
                note.style.marginTop = '10px';
                note.innerText = "*Tamu dapat scan ini untuk mendownload langsung.";
                qrContainer.appendChild(note);
            } else {
                qrContainer.innerHTML = '<p class="qr-text" style="color: red;">Gagal mengunggah file.</p>';
            }
        } catch (err) {
            console.error(err);
            qrContainer.innerHTML = '<p class="qr-text" style="color: red;">Tidak ada koneksi internet untuk QR.</p>';
        }
    }

    // Modal Close
    closeModal.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resultContainer.innerHTML = ''; // Clear memory
    });

    // Start
    initCamera();
});
