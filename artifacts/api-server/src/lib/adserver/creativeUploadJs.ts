/**
 * Browser side of creative upload (/account and /ads/admin). Checks the file before it leaves the browser (same rules as
 * creativeSpec.checkUpload, which still runs on the server), uploads the original, then makes the responsive WebP / AVIF
 * sizes and, for video, a poster frame with <canvas>, and sends them as variants. Nothing is sent anywhere else.
 */
import { COPY, FORMATS, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, RATIO_TOLERANCE, VIDEO_SECONDS } from "./creativeSpec";

export const CREATIVE_UPLOAD_JS = `(function(){
  var F = ${JSON.stringify(FORMATS.map((f) => ({ k: f.key, kind: f.kind, l: f.label, s: f.size, u: f.upload, m: f.min })))};
  var IMG = ["image/jpeg","image/png","image/webp","image/avif","image/gif"], VID = ["video/mp4","video/webm"];
  var MAXI = ${MAX_IMAGE_BYTES}, MAXV = ${MAX_VIDEO_BYTES}, TOL = ${RATIO_TOLERANCE}, VMIN = ${VIDEO_SECONDS.min}, VMAX = ${VIDEO_SECONDS.max}, ALTMIN = ${COPY.alt.min}, ALTMAX = ${COPY.alt.max};
  function match(kind, w, h){ var r = w / h, best = null, bd = 9; F.forEach(function(f){ if (f.kind !== kind) return; var d = Math.abs(r / (f.s[0] / f.s[1]) - 1); if (d <= TOL && d < bd) { best = f; bd = d; } }); return best; }
  function sizes(kind){ return F.filter(function(f){ return f.kind === kind; }).map(function(f){ return f.u[0] + "×" + f.u[1]; }).join(", "); }
  function typeOf(file){ var t = (file.type || "").toLowerCase(); if (t) return t; var n = file.name.toLowerCase(); return /\\.mp4$/.test(n) ? "video/mp4" : /\\.webm$/.test(n) ? "video/webm" : /\\.jpe?g$/.test(n) ? "image/jpeg" : /\\.png$/.test(n) ? "image/png" : /\\.webp$/.test(n) ? "image/webp" : /\\.avif$/.test(n) ? "image/avif" : t; }
  function meta(file, kind){ return new Promise(function(ok){ var url = URL.createObjectURL(file);
    if (kind === "image") { var i = new Image(); i.onload = function(){ ok({ w: i.naturalWidth, h: i.naturalHeight, url: url, el: i }); }; i.onerror = function(){ ok(null); }; i.src = url; return; }
    var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.onloadedmetadata = function(){ ok({ w: v.videoWidth, h: v.videoHeight, d: v.duration, url: url, el: v }); }; v.onerror = function(){ ok({ w: 0, h: 0, d: 0, url: url, el: null }); }; v.src = url; }); }
  function blob(canvas, type, q){ return new Promise(function(ok){ try { canvas.toBlob(function(b){ ok(b && b.type === type ? b : null); }, type, q); } catch (e) { ok(null); } }); }
  function draw(src, w, h){ var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h); return c; }
  function post(url, body, type){ return fetch(url, { method: "POST", headers: { "content-type": type || "application/octet-stream" }, body: body, credentials: "same-origin" }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.ok = r.ok && j.ok !== false; return j; }); }); }
  function poster(m){ return new Promise(function(ok){ var v = m.el; if (!v || !m.w) return ok(null); var t = Math.min(0.5, (m.d || 1) / 2);
    var done = false; function grab(){ if (done) return; done = true; var k = Math.min(1, 1920 / Math.max(m.w, m.h)); blob(draw(v, Math.round(m.w * k), Math.round(m.h * k)), "image/jpeg", 0.86).then(ok); }
    v.onseeked = grab; try { v.currentTime = t; } catch (e) { grab(); } setTimeout(function(){ if (!done) { done = true; ok(null); } }, 8000); }); }
  function say(f, text, bad){ var o = f.querySelector(".cu-msg"); if (!o) { o = document.createElement("p"); o.className = "cu-msg"; f.appendChild(o); } o.className = "cu-msg " + (bad ? "warn" : "ok"); o.setAttribute("role", bad ? "alert" : "status"); o.textContent = text; }
  document.addEventListener("submit", function(e){
    var f = e.target; if (!f.matches || !f.matches("form[data-creative-upload]")) return; e.preventDefault();
    var file = f.querySelector("input[type=file]").files[0]; if (!file) return say(f, "Choose an image or video to upload.", true);
    var t = typeOf(file), kind = IMG.indexOf(t) >= 0 ? "image" : VID.indexOf(t) >= 0 ? "video" : "";
    if (!kind) return say(f, /svg/.test(t) ? "SVG files can carry scripts, so we don't run them as ads. Export a PNG or WebP." : /heic|quicktime/.test(t) ? "That's an iPhone HEIC photo or a MOV video. Export JPG/PNG or MP4 (H.264)." : "Use JPG, PNG, WebP or AVIF for images, MP4 (H.264) or WebM for video.", true);
    if (file.size > (kind === "image" ? MAXI : MAXV)) return say(f, kind === "image" ? "That image is over 2 MB. Export it again as WebP or JPG at quality 80." : "That video is over 4 MB. Shorten it to 6–10 seconds or export at about 2 Mbps.", true);
    var fd = new FormData(f), alt = String(fd.get("alt") || "").trim();
    if (alt.length < ALTMIN || alt.length > ALTMAX) return say(f, "Add alt text: say what the ad shows in " + ALTMIN + "–" + ALTMAX + " characters.", true);
    var btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
    meta(file, kind).then(function(m){
      var force = fd.get("force") === "on";
      if (kind === "image" && !m) throw new Error("We couldn't open that image. Export it again as PNG, JPG or WebP.");
      if (m && m.w && !force) { var fm = match(kind, m.w, m.h); if (!fm) throw new Error(m.w + "×" + m.h + " doesn't match a slot shape. Use: " + sizes(kind) + ". Templates: /ads/specs");
        if (m.w < fm.m[0] || m.h < fm.m[1]) throw new Error(m.w + "×" + m.h + " is too small for a " + fm.l.toLowerCase() + ". Use at least " + fm.m[0] + "×" + fm.m[1] + " (best " + fm.u[0] + "×" + fm.u[1] + ")."); }
      if (kind === "video" && m && m.d && (m.d < VMIN - 0.25 || m.d > VMAX + 0.5)) throw new Error("That video is " + m.d.toFixed(1) + " seconds. Keep it " + VMIN + "–" + VMAX + " seconds (6–10 is best).");
      var q = ["alt=" + encodeURIComponent(alt)]; ["headline", "cta"].forEach(function(k){ var v = String(fd.get(k) || "").trim(); if (v) q.push(k + "=" + encodeURIComponent(v)); });
      if (fd.get("approve") === "on") q.push("approve=true"); if (force) q.push("force=true");
      var url = f.getAttribute("data-creative-upload"); say(f, "Checking and uploading…", false);
      return post(url + (url.indexOf("?") < 0 ? "?" : "&") + q.join("&"), file, t).then(function(j){
        if (!j.ok) throw new Error(j.message || "Upload failed. Try again.");
        var vb = f.getAttribute("data-variant-base") + j.id + "/variant?role=", jobs = Promise.resolve(), made = [];
        if (j.kind === "video") jobs = poster(m).then(function(b){ if (b) return post(vb + "poster", b, "image/jpeg").then(function(r){ if (r.ok) made.push("poster frame"); }); });
        else if (t !== "image/gif" && m && m.el) { var fmt = F.filter(function(x){ return x.k === j.format; })[0], base = fmt ? fmt.s[0] : Math.round(m.w / 2);
          var ws = [base, base * 2].filter(function(x, i, a){ return x <= m.w && a.indexOf(x) === i; }); if (!ws.length) ws = [m.w];
          ws.forEach(function(wd){ var ht = Math.round(wd * m.h / m.w); ["image/avif", "image/webp"].forEach(function(ty){ jobs = jobs.then(function(){ return blob(draw(m.el, wd, ht), ty, ty === "image/avif" ? 0.6 : 0.82).then(function(b){ if (b && b.size < file.size) return post(vb + ty.slice(6), b, ty).then(function(r){ if (r.ok) made.push(ty.slice(6).toUpperCase() + " " + wd + "px"); }); }); }); }); }); }
        return jobs.catch(function(){}).then(function(){ say(f, j.message + (made.length ? " Made: " + made.join(", ") + "." : ""), false); if (window.brToast) window.brToast("Uploaded"); setTimeout(function(){ location.reload(); }, 2600); });
      });
    }).catch(function(err){ say(f, err && err.message ? err.message : "Upload failed. Try again.", true); }).then(function(){ if (btn) btn.disabled = false; });
  });
})();`;

/** Upload form fields shared by /account and the admin. */
export function creativeFields(): string {
  return `<label>Image or video<input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm" required></label>
<label>Alt text (required: what the ad shows)<input name="alt" required minlength="${COPY.alt.min}" maxlength="${COPY.alt.max}" placeholder="e.g. Recovery cream, 20% off this week"></label>
<div class="row"><label>Headline (optional)<input name="headline" maxlength="${COPY.headline.max}" placeholder="Up to ${COPY.headline.max} characters"></label>
<label>Button (optional)<select name="cta"><option value="">No button</option>${COPY.cta.map((c) => `<option>${c}</option>`).join("")}</select></label></div>`;
}
