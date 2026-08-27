"use client";

import { useState, useRef } from "react";
import { Upload, X, Check } from "lucide-react";

export default function PhotoUploader() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(
    null
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 预览
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上传失败");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="p-5 rounded-xl border border-line bg-surface">
      <h3 className="text-sm font-semibold text-fg mb-3 font-mono flex items-center gap-2">
        <Upload size={15} className="text-accent" />
        上传照片
      </h3>

      {!preview && (
        <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-line2 rounded-lg cursor-pointer hover:border-accent/40 transition-colors">
          <Upload size={28} className="text-muted mb-2" />
          <span className="text-sm text-muted">点击选择照片上传</span>
          <span className="text-xs text-muted/50 mt-1">支持 JPG / PNG / WebP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      )}

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="预览"
            className="w-full max-h-64 object-cover rounded-lg border border-line"
          />
          <button
            onClick={reset}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-bg/80 border border-line hover:bg-surface2 transition-colors"
            aria-label="取消"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {uploading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted font-mono">
          <span className="inline-block w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
          上传中...
        </div>
      )}

      {result && (
        <div className="mt-3 flex items-start gap-2 text-sm text-green-400 bg-green-400/5 p-3 rounded-lg border border-green-400/15">
          <Check size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">上传成功</p>
            <p className="text-xs text-muted truncate mt-1">
              {result.name}
            </p>
            <p className="text-xs text-muted truncate mt-0.5">
              {result.url}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-400 bg-red-400/5 p-3 rounded-lg border border-red-400/15">
          {error}
        </div>
      )}
    </div>
  );
}