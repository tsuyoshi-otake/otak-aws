import { describe, it, expect, beforeEach } from 'vitest';
import { compressData, decompressData, generateShareUrl, parseSharedUrl } from './compression';

describe('LZ-String圧縮機能', () => {
  const sampleData = {
    version: "1.0",
    timestamp: Date.now(),
    boardItems: [
      {
        id: 'ec2-123',
        name: 'EC2',
        color: '#FF9900',
        category: 'Compute',
        x: 100,
        y: 100,
        type: 'service',
        customName: undefined,
        parentContainerId: null
      }
    ],
    containers: [
      {
        id: 'vpc-456',
        name: 'VPC',
        color: '#FF6B6B',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        type: 'container',
        borderStyle: 'solid',
        parentContainerId: null
      }
    ],
    connections: [
      {
        id: 'conn-789',
        from: 'ec2-123',
        to: 'rds-456',
        label: 'Database Connection'
      }
    ],
    settings: {
      zoomLevel: 100
    }
  };

  describe('compressData', () => {
    it('データをLZ-Stringで圧縮できること', () => {
      const compressed = compressData(sampleData);
      
      expect(compressed).toBeDefined();
      expect(typeof compressed).toBe('string');
      expect(compressed.length).toBeGreaterThan(0);
      
      // 圧縮されたデータは元のJSONよりも短いことを確認
      const originalJson = JSON.stringify(sampleData);
      expect(compressed.length).toBeLessThanOrEqual(originalJson.length);
    });

    it('空のオブジェクトでも正常に動作すること', () => {
      const emptyData = {
        version: "1.0",
        timestamp: Date.now(),
        boardItems: [],
        containers: [],
        connections: []
      };
      const compressed = compressData(emptyData);
      
      expect(compressed).toBeDefined();
      expect(typeof compressed).toBe('string');
    });

    it('nullまたはundefinedの場合はエラーをスローすること', () => {
      expect(() => compressData(null as any)).toThrow();
      expect(() => compressData(undefined as any)).toThrow();
    });
  });

  describe('decompressData', () => {
    it('圧縮されたデータを正しく復元できること', () => {
      const compressed = compressData(sampleData);
      const decompressed = decompressData(compressed);
      
      expect(decompressed).toEqual(sampleData);
    });

    it('無効な圧縮データの場合はnullを返すこと', () => {
      const invalidData = 'invalid-compressed-data';
      const result = decompressData(invalidData);
      
      expect(result).toBeNull();
    });

    it('空文字列の場合はnullを返すこと', () => {
      const result = decompressData('');
      
      expect(result).toBeNull();
    });
  });

  describe('generateShareUrl', () => {
    const mockLocation = {
      origin: 'https://example.com',
      pathname: '/otak-aws'
    };

    beforeEach(() => {
      // window.locationをモック
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });
    });

    it('有効なシェアURLを生成できること', () => {
      const shareUrl = generateShareUrl(sampleData);
      
      expect(shareUrl).toBeDefined();
      expect(shareUrl).toContain(mockLocation.origin);
      expect(shareUrl).toContain(mockLocation.pathname);
      expect(shareUrl).toContain('?data=');
      
      // URLからdataパラメータを抽出してデコードできることを確認
      const urlParams = new URLSearchParams(shareUrl.split('?')[1]);
      const dataParam = urlParams.get('data');
      expect(dataParam).toBeDefined();
      
      const decompressed = decompressData(dataParam!);
      expect(decompressed).toEqual(sampleData);
    });

    it('大きなデータセットでも正常にURLを生成できること', () => {
      const largeData = {
        ...sampleData,
        boardItems: Array.from({ length: 50 }, (_, i) => ({
          id: `service-${i}`,
          name: `Service ${i}`,
          color: '#FF9900',
          category: 'Compute',
          x: i * 100,
          y: i * 100,
          type: 'service'
        }))
      };
      
      const shareUrl = generateShareUrl(largeData);
      expect(shareUrl).toBeDefined();
      
      // 生成されたURLが適切な長さ制限内であることを確認
      expect(shareUrl.length).toBeLessThan(8000); // 一般的なURL長制限
    });
  });

  describe('parseSharedUrl', () => {
    it('共有URLからデータを正しく解析できること', () => {
      const shareUrl = generateShareUrl(sampleData);
      const parsedData = parseSharedUrl(shareUrl);
      
      expect(parsedData).toEqual(sampleData);
    });

    it('dataパラメータがないURLの場合はnullを返すこと', () => {
      const urlWithoutData = 'https://example.com/otak-aws';
      const result = parseSharedUrl(urlWithoutData);
      
      expect(result).toBeNull();
    });

    it('無効なdataパラメータの場合はnullを返すこと', () => {
      const invalidUrl = 'https://example.com/otak-aws?data=invalid-data';
      const result = parseSharedUrl(invalidUrl);
      
      expect(result).toBeNull();
    });
  });

  describe('旧Base64形式との互換性', () => {
    it('旧Base64エンコードされたデータも読み取れること', () => {
      // 旧形式のデータ（デフォルト値を含まない）
      const oldFormatData = {
        version: "1.0",
        timestamp: sampleData.timestamp,
        boardItems: [
          {
            id: 'ec2-123',
            name: 'EC2',
            color: '#FF9900',
            category: 'Compute',
            x: 100,
            y: 100,
            type: 'service'
          }
        ],
        containers: [
          {
            id: 'vpc-456',
            name: 'VPC',
            color: '#FF6B6B',
            x: 50,
            y: 50,
            width: 300,
            height: 200,
            type: 'container'
          }
        ],
        connections: [
          {
            id: 'conn-789',
            from: 'ec2-123',
            to: 'rds-456',
            label: 'Database Connection'
          }
        ],
        settings: {
          zoomLevel: 100
        }
      };
      
      const base64Data = btoa(JSON.stringify(oldFormatData));
      
      // Base64フォールバックを有効にして展開
      const result = decompressData(base64Data, true);
      
      expect(result).toBeDefined();
      expect(result?.version).toBe(oldFormatData.version);
      expect(result?.boardItems[0].id).toBe(oldFormatData.boardItems[0].id);
      // デフォルト値が追加されていることを確認
      expect(result?.boardItems[0].customName).toBeUndefined();
      expect(result?.boardItems[0].parentContainerId).toBeNull();
      expect(result?.containers[0].borderStyle).toBe('solid');
      expect(result?.containers[0].parentContainerId).toBeNull();
    });
  });

  describe('圧縮効率', () => {
    it('LZ-StringがBase64よりも効率的に圧縮できること', () => {
      const lzCompressed = compressData(sampleData);
      const base64Compressed = btoa(JSON.stringify(sampleData));
      
      // LZ-Stringの方が圧縮率が高いことを確認
      expect(lzCompressed.length).toBeLessThan(base64Compressed.length);
      console.log(`LZ-String: ${lzCompressed.length} chars, Base64: ${base64Compressed.length} chars`);
      console.log(`圧縮率向上: ${((base64Compressed.length - lzCompressed.length) / base64Compressed.length * 100).toFixed(1)}%`);
    });
  });

  describe('データ最適化', () => {
    it('デフォルト値は除外されること', () => {
      const dataWithDefaults = {
        version: "1.0",
        timestamp: Date.now(),
        boardItems: [{
          id: "item1",
          name: "EC2",
          customName: "EC2", // デフォルトと同じ（除外されるべき）
          color: "#FF9900",
          category: "Compute",
          x: 100,
          y: 100,
          parentContainerId: null,
          type: "service"
        }],
        containers: [{
          id: "container1",
          name: "VPC",
          color: "#FF9900",
          borderStyle: "solid", // デフォルト値（除外されるべき）
          x: 50,
          y: 50,
          width: 300,
          height: 200,
          parentContainerId: null,
          type: "container"
        }],
        connections: [{
          id: "conn1",
          from: "item1",
          to: "item2",
          label: "" // 空ラベル（除外されるべき）
        }],
        settings: {
          zoomLevel: 100 // デフォルト値（除外されるべき）
        }
      };

      const compressed = compressData(dataWithDefaults);
      const decompressed = decompressData(compressed);

      expect(decompressed).toBeTruthy();
      
      // デフォルト値が復元されることを確認
      expect(decompressed?.boardItems[0].customName).toBeUndefined();
      expect(decompressed?.containers[0].borderStyle).toBe('solid');
      expect(decompressed?.connections[0].label).toBe('');
      expect(decompressed?.settings?.zoomLevel).toBe(100);
    });

    it('カスタムラベルは保持されること', () => {
      const dataWithCustomLabels = {
        version: "1.0",
        timestamp: Date.now(),
        boardItems: [{
          id: "item1",
          name: "EC2",
          customName: "Web Server", // カスタムラベル（保持されるべき）
          color: "#FF9900",
          category: "Compute",
          x: 100,
          y: 100,
          type: "service"
        }],
        containers: [],
        connections: [{
          id: "conn1",
          from: "item1",
          to: "item2",
          label: "API Call" // カスタムラベル（保持されるべき）
        }],
        settings: {
          zoomLevel: 75 // 非デフォルト値（保持されるべき）
        }
      };

      const compressed = compressData(dataWithCustomLabels);
      const decompressed = decompressData(compressed);

      expect(decompressed).toBeTruthy();
      expect(decompressed?.boardItems[0].customName).toBe("Web Server");
      expect(decompressed?.connections[0].label).toBe("API Call");
      expect(decompressed?.settings?.zoomLevel).toBe(75);
    });
  });
});