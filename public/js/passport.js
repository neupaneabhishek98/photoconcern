// Passport Photo Maker UI
(function () {
  const dropZone      = document.getElementById("passportDrop");
  const fileInput     = document.getElementById("passportInput");
  const generateBtn   = document.getElementById("passportGenerate");
  const statusEl      = document.getElementById("passportStatus");
  const form          = document.getElementById("passportForm");
  const result        = document.getElementById("passportResult");
  const originalImg   = document.getElementById("passportOriginalPreview");
  const processedImg  = document.getElementById("passportProcessed");
  const downloadLink  = document.getElementById("passportDownload");
  const bgSelect      = document.getElementById("bgRemove");
  const dpiSelect     = document.getElementById("dpi");

  let pickedFile = null;

  function setStatus(msg, kind) {
    statusEl.className = "passport-status" + (kind ? " " + kind : "");
    statusEl.textContent = msg || "";
  }

  function pickFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus("File too large (max 10 MB).", "error");
      return;
    }
    pickedFile = file;
    generateBtn.disabled = false;
    const url = URL.createObjectURL(file);
    originalImg.src = url;
    result.hidden = false;
    processedImg.removeAttribute("src");
    downloadLink.removeAttribute("href");
    setStatus(`Loaded ${file.name}`, "success");
  }

  // Drag & drop
  ["dragenter", "dragover"].forEach((e) => {
    dropZone.addEventListener(e, (ev) => {
      ev.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((e) => {
    dropZone.addEventListener(e, (ev) => {
      ev.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (ev) => {
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) pickFile(f);
  });
  fileInput.addEventListener("change", (e) => pickFile(e.target.files[0]));

  // Submit
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!pickedFile) return;

    generateBtn.disabled = true;
    setStatus("Processing… this may take a few seconds.");

    const fd = new FormData();
    fd.append("photo", pickedFile);
    fd.append("bg", bgSelect.value);
    fd.append("dpi", dpiSelect.value);

    try {
      const res = await fetch("/api/tools/passport", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (!res.ok) {
        let msg = "Processing failed (HTTP " + res.status + ")";
        try {
          const body = await res.json();
          msg = body.message || msg;
          if (body.detail) msg += "\n\nDetails: " + body.detail;
        } catch (_) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      processedImg.src = url;
      downloadLink.href = url;
      downloadLink.download = "passport-photo.jpg";
      setStatus("Done! Tap “Download JPG” to save.", "success");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong.", "error");
    } finally {
      generateBtn.disabled = false;
    }
  });
})();
