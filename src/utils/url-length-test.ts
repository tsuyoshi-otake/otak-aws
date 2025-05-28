import { compressData, type ArchitectureData } from './compression';

// テスト用の大きなデータを生成
export function generateLargeTestData(): ArchitectureData {
  const boardItems: any[] = [];
  const containers: any[] = [];
  const connections: any[] = [];
  
  // 多数のアイテムを生成
  for (let i = 0; i < 50; i++) {
    boardItems.push({
      id: `item-${i}`,
      name: `EC2 Instance ${i}`,
      customName: `Custom EC2 Instance with very long name ${i}`,
      color: '#FF9900',
      category: 'Compute',
      x: 100 + (i % 10) * 100,
      y: 100 + Math.floor(i / 10) * 100,
      parentContainerId: null,
      type: 'service' as const
    });
    
    if (i % 5 === 0) {
      containers.push({
        id: `container-${i}`,
        name: `VPC Container ${i}`,
        color: '#FF6B6B',
        borderStyle: 'dashed',
        x: 50 + (i % 5) * 200,
        y: 50 + Math.floor(i / 5) * 200,
        width: 400,
        height: 300,
        parentContainerId: null,
        type: 'container' as const
      });
    }
    
    if (i > 0) {
      connections.push({
        id: `conn-${i}`,
        from: `item-${i-1}`,
        to: `item-${i}`,
        label: `Connection ${i} with additional description`
      });
    }
  }
  
  return {
    version: "1.0",
    timestamp: Date.now(),
    boardItems,
    containers,
    connections,
    settings: {
      zoomLevel: 150
    }
  };
}

// URL長さをテスト
export function testUrlLength() {
  const testData = generateLargeTestData();
  const compressed = compressData(testData);
  const baseUrl = "https://tsuyoshi-otake.github.io/otak-aws/";
  const fullUrl = `${baseUrl}?data=${compressed}`;
  
  console.log('Test Results:');
  console.log(`- Items: ${testData.boardItems.length}`);
  console.log(`- Containers: ${testData.containers.length}`);
  console.log(`- Connections: ${testData.connections.length}`);
  console.log(`- Compressed data length: ${compressed.length} characters`);
  console.log(`- Full URL length: ${fullUrl.length} characters`);
  console.log(`- Within Chrome limit (2000): ${fullUrl.length <= 2000 ? 'YES' : 'NO'}`);
  
  return {
    dataLength: compressed.length,
    urlLength: fullUrl.length,
    withinLimit: fullUrl.length <= 2000
  };
}