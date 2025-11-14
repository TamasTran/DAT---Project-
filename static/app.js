const uploadForm = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const resultSection = document.getElementById("resultSection");
const resultLabel = document.getElementById("resultLabel");
const resultConfidence = document.getElementById("resultConfidence");
const probabilityList = document.getElementById("probabilityList");
const toast = document.getElementById("toast");
const cameraControls = document.getElementById("cameraControls");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const cameraStream = document.getElementById("cameraStream");
const captureCanvas = document.getElementById("captureCanvas");
const cameraWarning = document.getElementById("cameraWarning");
const submitBtn = document.querySelector(".primary-btn");

let capturedBlob = null;
let mediaStream = null;
let toastTimeout;

const LOCAL_ORIGINS = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocalOrigin = LOCAL_ORIGINS.has(location.hostname);
const isSecureOrigin = window.isSecureContext || isLocalOrigin;
const hasMediaDevicesApi = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const showToast = (message, isError = false) => {
  toast.textContent = message;
  toast.style.background = isError ? "rgba(196, 59, 59, 0.95)" : "rgba(8, 20, 53, 0.92)";
  toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 3500);
};

const getCameraSupportMessage = () => {
  if (!hasMediaDevicesApi) {
    return "Trình duyệt không hỗ trợ getUserMedia. Hãy cập nhật trình duyệt hoặc dùng nút 'Chọn ảnh'.";
  }
  if (!isSecureOrigin) {
    return "Camera trực tiếp chỉ hoạt động khi truy cập qua HTTPS hoặc từ localhost. Hãy cấu hình HTTPS hoặc dùng chức năng tải ảnh.";
  }
  return "";
};

const cameraSupportMessage = getCameraSupportMessage();

const updateCameraSupportBanner = () => {
  if (!cameraWarning) return;
  if (!cameraSupportMessage) {
    cameraWarning.classList.add("hidden");
    startCameraBtn.disabled = false;
    startCameraBtn.removeAttribute("title");
    cameraControls?.classList.remove("hidden");
    return;
  }

  const shouldDisplayWarning = !isMobileDevice;
  if (shouldDisplayWarning) {
    cameraWarning.textContent = cameraSupportMessage;
    cameraWarning.classList.remove("hidden");
    startCameraBtn.title = cameraSupportMessage;
  } else {
    cameraWarning.classList.add("hidden");
    startCameraBtn.removeAttribute("title");
  }

  startCameraBtn.disabled = true;
  cameraControls?.classList.add("hidden");
};

updateCameraSupportBanner();

const updatePreview = (url) => {
  if (!url) {
    previewImage.hidden = true;
    previewPlaceholder.textContent = "Chưa có ảnh được chọn.";
    previewPlaceholder.hidden = false;
    return;
  }

  previewImage.src = url;
  previewImage.hidden = false;
  previewPlaceholder.hidden = true;
};

const resetCapturedBlob = () => {
  capturedBlob = null;
};

imageInput.addEventListener("change", () => {
  resetCapturedBlob();
  if (!imageInput.files.length) {
    updatePreview(null);
    return;
  }

  const file = imageInput.files[0];
  const reader = new FileReader();
  reader.onload = (event) => updatePreview(event.target.result);
  reader.readAsDataURL(file);
});

const stopCamera = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  cameraStream.srcObject = null;
  cameraStream.hidden = true;
  captureBtn.disabled = true;
  stopCameraBtn.disabled = true;
};

const canUseLiveCamera = () => hasMediaDevicesApi && isSecureOrigin;

startCameraBtn.addEventListener("click", async () => {
  if (!canUseLiveCamera()) {
    showToast(
      cameraSupportMessage ||
        "Không thể bật camera trong môi trường hiện tại. Hãy truy cập bằng HTTPS hoặc dùng tính năng tải ảnh.",
      true,
    );
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    cameraStream.srcObject = mediaStream;
    cameraStream.hidden = false;
    captureBtn.disabled = false;
    stopCameraBtn.disabled = false;
    showToast("Camera đã bật. Nhấn 'Chụp ảnh' khi sẵn sàng.");
  } catch (error) {
    showToast("Không thể truy cập camera: " + error.message, true);
  }
});

stopCameraBtn.addEventListener("click", () => {
  stopCamera();
  showToast("Đã tắt camera.");
});

captureBtn.addEventListener("click", async () => {
  if (!mediaStream) {
    showToast("Camera chưa được bật.", true);
    return;
  }

  const videoTrack = mediaStream.getVideoTracks()[0];
  if (!videoTrack) {
    showToast("Không tìm thấy track video.", true);
    return;
  }

  const { videoWidth, videoHeight } = cameraStream;
  captureCanvas.width = videoWidth;
  captureCanvas.height = videoHeight;
  const ctx = captureCanvas.getContext("2d");
  ctx.drawImage(cameraStream, 0, 0, videoWidth, videoHeight);

  capturedBlob = await new Promise((resolve) =>
    captureCanvas.toBlob(resolve, "image/jpeg", 0.92),
  );

  if (!capturedBlob) {
    showToast("Chụp ảnh thất bại, thử lại.", true);
    return;
  }

  const objectURL = URL.createObjectURL(capturedBlob);
  updatePreview(objectURL);
  imageInput.value = "";
  showToast("Đã chụp ảnh, nhấn 'Dự đoán' để xem kết quả.");
});

const setLoadingState = (isLoading) => {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Đang dự đoán..." : "2. Dự đoán";
};

const renderProbabilities = (probabilities) => {
  probabilityList.innerHTML = "";
  const entries = Object.entries(probabilities || {}).sort((a, b) => b[1] - a[1]);

  entries.forEach(([label, value]) => {
    const div = document.createElement("div");
    div.className = "prob-item";
    div.innerHTML = `<strong>${label}</strong><span>${formatPercent(value)}</span>`;
    probabilityList.appendChild(div);
  });
};

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fileToSend = capturedBlob
    ? new File([capturedBlob], "capture.jpg", { type: "image/jpeg" })
    : imageInput.files[0];

  if (!fileToSend) {
    showToast("Vui lòng chọn hoặc chụp một ảnh trước.", true);
    return;
  }

  const formData = new FormData();
  formData.append("image", fileToSend);

  setLoadingState(true);
  resultSection.classList.add("hidden");

  try {
    const response = await fetch("/predict", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Không thể dự đoán.");
    }

    resultLabel.textContent = data.label;
    resultConfidence.textContent = formatPercent(Number(data.confidence ?? 0));
    renderProbabilities(data.probabilities);
    resultSection.classList.remove("hidden");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoadingState(false);
  }
});

window.addEventListener("beforeunload", stopCamera);
