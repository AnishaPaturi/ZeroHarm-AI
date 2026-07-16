'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadBoxProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export default function UploadBox({ onFileSelect, accept = '*/*', multiple = true }: UploadBoxProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const startUploadSimulation = (files: File[]) => {
    setUploading(true);
    setProgress(0);
    
    // Simulate upload speed
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          const meta = files.map(f => ({ name: f.name, size: formatSize(f.size), type: f.type }));
          setUploadedFiles(prevFiles => [...prevFiles, ...meta]);
          onFileSelect(files);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const filesArray = Array.from(e.dataTransfer.files);
      startUploadSimulation(filesArray);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const filesArray = Array.from(e.target.files);
      startUploadSimulation(filesArray);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full py-8 px-6 rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center text-center smooth-hover select-none ${
          isDragActive 
            ? 'border-safety-orange bg-safety-orange/5' 
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
        />

        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
          <UploadCloud className="w-6 h-6 text-slate-300" />
        </div>

        <p className="text-sm font-medium text-white">
          Drag & drop evidence files here, or <span className="text-safety-orange hover:underline">browse files</span>
        </p>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Supports PNG, JPG, MP4, PDF (Max 25MB)
        </p>
      </div>

      {/* Progress Bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3"
          >
            <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5 font-mono">
              <span>Uploading evidence logs...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-safety-orange to-amber-500 h-2 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex flex-col gap-2"
          >
            {uploadedFiles.map((file, idx) => {
              const isImage = file.type.startsWith('image/');
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                      {isImage ? <ImageIcon className="w-4 h-4 text-sky-400" /> : <File className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="truncate pr-4">
                      <p className="font-medium text-white truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{file.size}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1 rounded bg-white/5 text-slate-400 hover:text-red-400 hover:bg-white/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
