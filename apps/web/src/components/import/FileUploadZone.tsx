'use client';

import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CloudUpload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  selectedFile?: File | null;
  onClear?: () => void;
}

const ACCEPTED_TYPES = [
  'text/csv',
  'application/pdf',
  'application/vnd.ms-excel',
];
const ACCEPTED_EXTENSIONS = ['.csv', '.pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadZone({ onFileSelect, isUploading, selectedFile, onClear }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      return 'Only CSV and PDF files are supported';
    }
    if (file.size > MAX_SIZE) {
      return 'File must be under 10MB';
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const err = validateFile(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [validateFile, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  // File selected preview
  if (selectedFile && !error) {
    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
    return (
      <motion.div
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-6',
          'border-primary-500/40 bg-primary-500/5',
          'dark:border-primary-400/30 dark:bg-primary-400/5',
        )}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center',
              isPdf
                ? 'bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400'
                : 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400',
            )}
          >
            <FileText className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate">
              {selectedFile.name}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatFileSize(selectedFile.size)} &middot; {isPdf ? 'PDF' : 'CSV'}
            </p>
          </div>
          {!isUploading && onClear && (
            <button
              onClick={onClear}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isUploading && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 3, ease: 'easeInOut' }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Uploading...</p>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-8 transition-colors cursor-pointer',
          'flex flex-col items-center justify-center text-center',
          isDragOver
            ? 'border-primary-500 bg-primary-500/10 dark:border-primary-400 dark:bg-primary-400/10'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 dark:border-white/20 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10',
          isUploading && 'pointer-events-none opacity-60',
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        <motion.div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
            'bg-primary-500/10 text-primary-500 dark:bg-primary-400/10 dark:text-primary-400',
          )}
          animate={isDragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
        >
          <CloudUpload className="w-8 h-8" />
        </motion.div>

        <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">
          {isDragOver ? 'Drop your file here' : 'Drag & drop your file'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          or click to browse
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          CSV, PDF up to 10MB
        </p>
      </motion.div>

      {error && (
        <motion.p
          className="mt-3 text-sm text-red-500 dark:text-red-400 text-center"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
