
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getMemories } from './db';
import { MediaType } from '../types';

export const saveSingleMediaToPublic = async (
  base64DataWithPrefix: string, 
  type: MediaType, 
  folderName: string = "Thakira_Media"
): Promise<boolean> => {
    try {
        // Extract raw base64
        const parts = base64DataWithPrefix.split(',');
        const pureBase64 = parts.length > 1 ? parts[1] : parts[0];
        
        if (!pureBase64) return false;

        const ext = type === MediaType.IMAGE ? 'jpg' : type === MediaType.VIDEO ? 'mp4' : 'mp3';
        // Generate a unique filename: Thakira_YYYYMMDD_HHMMSS_RAND.ext
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T.]/g, '').substring(0, 14); 
        const filename = `${folderName}/Thakira_${timeStr}_${Math.floor(Math.random()*1000)}.${ext}`;

        // Ensure directory exists
        try {
            await Filesystem.mkdir({
                path: folderName,
                directory: Directory.Documents,
                recursive: true
            });
        } catch (e) {
            // Directory likely exists
        }

        // Write file
        await Filesystem.writeFile({
            path: filename,
            data: pureBase64,
            directory: Directory.Documents
        });
        
        return true;
    } catch (e) {
        console.error("Auto-save failed", e);
        return false;
    }
};

export const saveMediaToDownloads = async (onProgress: (current: number, total: number) => void): Promise<string> => {
    try {
        const memories = await getMemories();
        const mediaMemories = memories.filter(m => m.content && (m.type === MediaType.IMAGE || m.type === MediaType.VIDEO || m.type === MediaType.AUDIO));
        
        let successCount = 0;
        const total = mediaMemories.length;

        // Use Documents folder which is accessible via Scoped Storage
        const FOLDER = 'Thakira_Media_Export';

        // Attempt to create folder (ignore error if exists)
        try {
            await Filesystem.mkdir({
                path: FOLDER,
                directory: Directory.Documents,
                recursive: true
            });
        } catch (e) {
            // Folder likely exists
        }

        for (let i = 0; i < total; i++) {
            const m = mediaMemories[i];
            const date = new Date(m.createdAt).toISOString().split('T')[0];
            const ext = m.type === MediaType.IMAGE ? 'jpg' : m.type === MediaType.VIDEO ? 'mp4' : 'mp3';
            const filename = `${FOLDER}/Thakira_${date}_${m.id.substring(0,6)}.${ext}`;
            
            // Extract base64 raw data
            const base64Data = m.content.split(',')[1];
            if (!base64Data) continue;

            await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Documents
            });
            
            successCount++;
            onProgress(i + 1, total);
        }

        return `تم تصدير ${successCount} ملف إلى مجلد المستندات (Documents/${FOLDER}).`;
    } catch (e: any) {
        console.error("Export Error", e);
        if (e.message?.includes("Permission")) {
            throw new Error("يرجى منح صلاحية الوصول للملفات في إعدادات الهاتف.");
        }
        throw new Error("حدث خطأ أثناء التصدير: " + e.message);
    }
};

export const downloadBackupFile = (jsonString: string) => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thakira_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
