import LZString from 'lz-string';

/**
 * アーキテクチャデータの型定義
 */
export interface ArchitectureData {
  version: string;
  timestamp: number;
  boardItems: any[];
  containers: any[];
  connections: any[];
  settings?: {
    zoomLevel?: number;
  };
}

/**
 * データを最適化してデフォルト値を除外する
 * @param data 最適化するデータ
 * @returns 最適化されたデータ
 */
function optimizeDataForCompression(data: ArchitectureData): ArchitectureData {
  const optimized: ArchitectureData = {
    version: data.version,
    timestamp: data.timestamp,
    boardItems: data.boardItems.map(item => {
      const optimizedItem: any = {
        id: item.id,
        name: item.name,
        color: item.color,
        category: item.category,
        x: item.x,
        y: item.y,
        type: item.type
      };
      
      // カスタムラベルがある場合のみ追加
      if (item.customName && item.customName !== item.name) {
        optimizedItem.customName = item.customName;
      }
      
      // 親コンテナがある場合のみ追加
      if (item.parentContainerId) {
        optimizedItem.parentContainerId = item.parentContainerId;
      }
      
      return optimizedItem;
    }),
    containers: data.containers.map(container => {
      const optimizedContainer: any = {
        id: container.id,
        name: container.name,
        color: container.color,
        x: container.x,
        y: container.y,
        width: container.width,
        height: container.height,
        type: container.type
      };
      
      // デフォルトではないボーダースタイルの場合のみ追加
      if (container.borderStyle && container.borderStyle !== 'solid') {
        optimizedContainer.borderStyle = container.borderStyle;
      }
      
      // 親コンテナがある場合のみ追加
      if (container.parentContainerId) {
        optimizedContainer.parentContainerId = container.parentContainerId;
      }
      
      return optimizedContainer;
    }),
    connections: data.connections.map(connection => {
      const optimizedConnection: any = {
        id: connection.id,
        from: connection.from,
        to: connection.to
      };
      
      // ラベルがある場合のみ追加
      if (connection.label && connection.label.trim()) {
        optimizedConnection.label = connection.label;
      }
      
      return optimizedConnection;
    })
  };
  
  // デフォルトではないズームレベルの場合のみ追加
  if (data.settings?.zoomLevel && data.settings.zoomLevel !== 100) {
    optimized.settings = {
      zoomLevel: data.settings.zoomLevel
    };
  }
  
  return optimized;
}

/**
 * 最適化されたデータを元の形式に復元する
 * @param optimizedData 最適化されたデータ
 * @returns 復元されたデータ
 */
function restoreDataFromOptimized(optimizedData: ArchitectureData): ArchitectureData {
  return {
    version: optimizedData.version,
    timestamp: optimizedData.timestamp,
    boardItems: optimizedData.boardItems.map(item => ({
      ...item,
      customName: item.customName || undefined,
      parentContainerId: item.parentContainerId || null
    })),
    containers: optimizedData.containers.map(container => ({
      ...container,
      borderStyle: container.borderStyle || 'solid',
      parentContainerId: container.parentContainerId || null
    })),
    connections: optimizedData.connections.map(connection => ({
      ...connection,
      label: connection.label || ''
    })),
    settings: {
      zoomLevel: optimizedData.settings?.zoomLevel || 100
    }
  };
}

/**
 * データをLZ-Stringで圧縮する
 * @param data 圧縮するデータ
 * @returns 圧縮された文字列
 */
export function compressData(data: ArchitectureData): string {
  if (!data) {
    throw new Error('データが無効です');
  }

  try {
    // データを最適化してからJSON化
    const optimizedData = optimizeDataForCompression(data);
    const jsonString = JSON.stringify(optimizedData);
    const compressed = LZString.compressToEncodedURIComponent(jsonString);
    
    if (!compressed) {
      throw new Error('圧縮に失敗しました');
    }
    
    return compressed;
  } catch (error) {
    console.error('データ圧縮エラー:', error);
    throw new Error('データの圧縮中にエラーが発生しました');
  }
}

/**
 * LZ-Stringで圧縮されたデータを展開する
 * @param compressedData 圧縮されたデータ
 * @param fallbackToBase64 Base64フォールバックを有効にするか
 * @returns 展開されたデータ、または失敗時はnull
 */
export function decompressData(compressedData: string, fallbackToBase64: boolean = false): ArchitectureData | null {
  if (!compressedData || compressedData.trim() === '') {
    return null;
  }

  try {
    // まずLZ-Stringで展開を試行
    const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
    
    if (decompressed) {
      const parsed = JSON.parse(decompressed);
      return restoreDataFromOptimized(parsed as ArchitectureData);
    }
    
    // LZ-Stringで失敗した場合、Base64フォールバックを試行
    if (fallbackToBase64) {
      try {
        const base64Decoded = atob(compressedData);
        const parsed = JSON.parse(base64Decoded);
        return restoreDataFromOptimized(parsed as ArchitectureData);
      } catch (base64Error) {
        console.warn('Base64フォールバックも失敗:', base64Error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('データ展開エラー:', error);
    return null;
  }
}

/**
 * アーキテクチャデータから共有URLを生成する
 * @param data アーキテクチャデータ
 * @returns 共有URL
 */
export function generateShareUrl(data: ArchitectureData): string {
  try {
    const compressed = compressData(data);
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?data=${compressed}`;
    
    return shareUrl;
  } catch (error) {
    console.error('共有URL生成エラー:', error);
    throw new Error('共有URLの生成に失敗しました');
  }
}

/**
 * 共有URLからアーキテクチャデータを解析する
 * @param url 共有URL
 * @returns 解析されたデータ、または失敗時はnull
 */
export function parseSharedUrl(url: string): ArchitectureData | null {
  try {
    const urlObj = new URL(url);
    const dataParam = urlObj.searchParams.get('data');
    
    if (!dataParam) {
      return null;
    }
    
    // LZ-Stringでの展開を試行し、失敗した場合はBase64フォールバックを使用
    return decompressData(dataParam, true);
  } catch (error) {
    console.error('URL解析エラー:', error);
    return null;
  }
}

/**
 * 圧縮効率を比較する（デバッグ用）
 * @param data 比較するデータ
 * @returns 圧縮効率の統計情報
 */
export function compareCompressionEfficiency(data: ArchitectureData): {
  original: number;
  lzString: number;
  base64: number;
  lzStringRatio: number;
  base64Ratio: number;
  improvement: number;
} {
  const originalJson = JSON.stringify(data);
  const lzCompressed = compressData(data);
  const base64Compressed = btoa(originalJson);
  
  const originalSize = originalJson.length;
  const lzSize = lzCompressed.length;
  const base64Size = base64Compressed.length;
  
  return {
    original: originalSize,
    lzString: lzSize,
    base64: base64Size,
    lzStringRatio: (lzSize / originalSize) * 100,
    base64Ratio: (base64Size / originalSize) * 100,
    improvement: ((base64Size - lzSize) / base64Size) * 100
  };
}

/**
 * データサイズが大きすぎないかチェックする
 * @param data チェックするデータ
 * @param maxSizeKB 最大サイズ（KB）
 * @returns サイズチェック結果
 */
export function checkDataSize(data: ArchitectureData, maxSizeKB: number = 50): {
  isValid: boolean;
  originalSizeKB: number;
  compressedSizeKB: number;
  message: string;
} {
  const originalJson = JSON.stringify(data);
  const compressed = compressData(data);
  
  const originalSizeKB = originalJson.length / 1024;
  const compressedSizeKB = compressed.length / 1024;
  
  const isValid = compressedSizeKB <= maxSizeKB;
  
  return {
    isValid,
    originalSizeKB: Math.round(originalSizeKB * 100) / 100,
    compressedSizeKB: Math.round(compressedSizeKB * 100) / 100,
    message: isValid 
      ? `データサイズは適切です (${compressedSizeKB.toFixed(2)}KB/${maxSizeKB}KB)`
      : `データサイズが大きすぎます (${compressedSizeKB.toFixed(2)}KB/${maxSizeKB}KB)`
  };
}