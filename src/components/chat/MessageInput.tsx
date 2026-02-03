import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, Paperclip, X, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessageInputProps {
  onSend: (content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  themeClasses: {
    input: string;
    iconColor: string;
    hoverBtn: string;
  };
}

export function MessageInput({ 
  onSend, 
  onTyping, 
  disabled = false, 
  placeholder = 'Digite uma mensagem...',
  themeClasses 
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const handleSend = async () => {
    if ((!message.trim() && !selectedFile) || isSending) return;
    
    setIsSending(true);
    try {
      if (selectedFile) {
        // Upload file logic would go here
        // For now, just send the message
        await onSend(message.trim());
      } else {
        await onSend(message.trim());
      }
      setMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: file.type });
          setSelectedFile(namedFile);
          setPreviewUrl(URL.createObjectURL(namedFile));
          toast({ title: 'Imagem colada!', description: 'Pressione Enter para enviar' });
        }
        break;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping?.();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        setSelectedFile(new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' }));
        setPreviewUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({ title: 'Erro', description: 'Microfone não disponível', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3">
      {/* File preview */}
      {previewUrl && (
        <div className="mb-2 relative inline-block">
          {selectedFile?.type.startsWith('image/') ? (
            <img src={previewUrl} alt="Preview" className="max-h-32 rounded-lg" />
          ) : selectedFile?.type.startsWith('audio/') ? (
            <audio controls src={previewUrl} className="max-w-[200px]" />
          ) : (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <span className="text-sm truncate max-w-[150px]">{selectedFile?.name}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFile}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isRecording}
          className={`h-10 w-10 rounded-full flex-shrink-0 ${themeClasses.iconColor} ${themeClasses.hoverBtn}`}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Textarea
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isRecording}
          className={`flex-1 min-h-[44px] max-h-32 rounded-2xl resize-none border-0 whitespace-pre-wrap ${themeClasses.input}`}
          rows={1}
          style={{ whiteSpace: 'pre-wrap' }}
        />

        {message.trim() || selectedFile ? (
          <Button
            onClick={handleSend}
            disabled={disabled || isSending}
            className="h-10 w-10 rounded-full bg-[#00A884] hover:bg-[#00926e] flex-shrink-0"
          >
            <Send className="h-5 w-5 text-white" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={disabled}
            className={`h-10 w-10 rounded-full flex-shrink-0 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : `${themeClasses.iconColor} ${themeClasses.hoverBtn}`
            }`}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
