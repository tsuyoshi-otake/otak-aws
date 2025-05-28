import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, Download, RotateCcw, Plus, Square, Box, Move, Share } from 'lucide-react';
import { compressData, decompressData, generateShareUrl, parseSharedUrl, checkDataSize, type ArchitectureData } from './utils/compression';

// 型定義
interface ServiceItem {
  id: string;
  name: string;
  customName?: string;
  color: string;
  category: string;
  x: number;
  y: number;
  parentContainerId?: string | null;
  type: 'service';
}

interface ContainerItem {
  id: string;
  name: string;
  color: string;
  borderStyle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentContainerId?: string | null;
  type: 'container';
}

interface Connection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

type DraggedItem = (ServiceItem | ContainerItem) & {
  type: 'service' | 'container';
};

const AWSArchitectureBoard = () => {
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [boardItems, setBoardItems] = useState<ServiceItem[]>([]);
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedTool, setSelectedTool] = useState('service'); // 'service', 'container', 'connection'
  const [connectionStart, setConnectionStart] = useState<ServiceItem | null>(null);
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [editingLabel, setEditingLabel] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [editingConnectionLabel, setEditingConnectionLabel] = useState(null);
  const [editingConnectionText, setEditingConnectionText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [exportFormat, setExportFormat] = useState('eraser'); // 'eraser', 'flowchart'
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('unknown');
  const [zoomLevel, setZoomLevel] = useState(100); // 100% or 75%
  const [copySuccess, setCopySuccess] = useState(false);
  
  // リサイズ機能用の状態
  const [resizingContainer, setResizingContainer] = useState(null);
  const [resizeType, setResizeType] = useState(null); // 'width', 'height', 'both'
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  
  // 履歴の型定義
  interface HistoryState {
    boardItems: ServiceItem[];
    containers: ContainerItem[];
    connections: Connection[];
    timestamp: number;
  }
  
  // Undo機能用の履歴管理
  const [undoHistory, setUndoHistory] = useState<HistoryState[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const maxHistorySize = 50; // 最大履歴数
  const baseGridSize = 80;
  const baseServiceSize = 80; // サービスアイテムのベースサイズ
  const gridSize = Math.round(baseGridSize * (zoomLevel / 100));
  const serviceSize = Math.round(baseServiceSize * (zoomLevel / 100));
  const boardRef = useRef<HTMLDivElement>(null);

  // 現在の状態を履歴に保存
  const saveToHistory = useCallback(() => {
    if (isUndoing) return; // undo実行中は履歴に保存しない
    
    const currentState = {
      boardItems: [...boardItems],
      containers: [...containers],
      connections: [...connections],
      timestamp: Date.now()
    };
    
    setUndoHistory(prev => {
      const newHistory = [...prev, currentState];
      // 最大履歴数を超えた場合は古いものを削除
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(-maxHistorySize);
      }
      return newHistory;
    });
  }, [boardItems, containers, connections, isUndoing, maxHistorySize]);

  // Undo実行
  const executeUndo = useCallback(() => {
    if (undoHistory.length === 0) return;
    
    setIsUndoing(true);
    
    const previousState = undoHistory[undoHistory.length - 1];
    
    // 状態を復元
    setBoardItems(previousState.boardItems);
    setContainers(previousState.containers);
    setConnections(previousState.connections);
    
    // 編集状態をクリア
    setEditingLabel(null);
    setEditingText('');
    setEditingConnectionLabel(null);
    setEditingConnectionText('');
    setConnectionStart(null);
    setIsDrawingConnection(false);
    
    // 履歴から削除
    setUndoHistory(prev => prev.slice(0, -1));
    
    // undo実行フラグをリセット
    setTimeout(() => setIsUndoing(false), 100);
  }, [undoHistory]);

  // URL復元機能
  useEffect(() => {
    const loadFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedData = urlParams.get('data');
      
      if (sharedData) {
        try {
          const decodedData = atob(sharedData);
          const parsedData = JSON.parse(decodedData);
          
          // データを復元
          setBoardItems(parsedData.boardItems || []);
          setContainers(parsedData.containers || []);
          setConnections(parsedData.connections || []);
          
          // 設定を復元（オプション）
          if (parsedData.settings) {
            setSnapToGrid(parsedData.settings.snapToGrid ?? snapToGrid);
            setShowGrid(parsedData.settings.showGrid ?? showGrid);
            setIsDarkMode(parsedData.settings.isDarkMode ?? isDarkMode);
            setAdvancedMode(parsedData.settings.advancedMode ?? advancedMode);
            setZoomLevel(parsedData.settings.zoomLevel ?? zoomLevel);
          }
          
          // URLからパラメータを削除（ブラウザ履歴は残す）
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          
          console.log('Architecture loaded from URL');
        } catch (error) {
          console.error('Failed to load architecture from URL:', error);
        }
      }
    };

    loadFromUrl();
  }, []); // 空の依存配列で初回のみ実行

  // キーボードイベントリスナー
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z (Windows/Linux) または Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        executeUndo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [executeUndo]);

  // URL読み込み機能: ページ読み込み時に共有URLからデータを復元
  useEffect(() => {
    const handleLoadFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      
      if (dataParam) {
        try {
          const parsedData = parseSharedUrl(window.location.href);
          
          if (parsedData) {
            setBoardItems(parsedData.boardItems);
            setContainers(parsedData.containers);
            setConnections(parsedData.connections);
            
            // ズームレベルのみ復元
            if (parsedData.settings) {
              setZoomLevel(parsedData.settings.zoomLevel ?? 100);
            }
            
            console.log('Architecture loaded from shared URL (LZ-String decompressed)');
          } else {
            console.warn('Failed to parse shared URL data');
          }
        } catch (error) {
          console.error('Error loading shared URL:', error);
        }
        
        // URLパラメータをクリアして履歴を汚さないようにする
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    };

    handleLoadFromUrl();
  }, []); // 初回レンダリング時のみ実行

  // Share機能: 現在の構成をLZ-String圧縮してURLを生成
  const handleGenerateShareUrl = () => {
    const currentData: ArchitectureData = {
      version: "1.0",
      timestamp: Date.now(),
      boardItems,
      containers,
      connections,
      settings: {
        zoomLevel
      }
    };

    try {
      // まず圧縮データを生成
      const compressed = compressData(currentData);
      
      // ベースURLとクエリパラメータを含めた全体のURL長さを計算
      const baseUrl = "https://tsuyoshi-otake.github.io/otak-aws/";
      const fullUrl = `${baseUrl}?data=${compressed}`;
      const urlLength = fullUrl.length;
      
      // Chromeの制限（2,083文字）に余裕を持たせて2,000文字を上限とする
      const maxUrlLength = 2000;
      
      if (urlLength > maxUrlLength) {
        // URL長さが制限を超えた場合
        alert(
          `シェアできませんでした。\n\n` +
          `アーキテクチャが大きすぎるため、共有URLを生成できません。\n` +
          `URL長さ: ${urlLength}文字 (上限: ${maxUrlLength}文字)\n\n` +
          `より小さなアーキテクチャで再度お試しください。`
        );
        return;
      }
      
      setShareUrl(fullUrl);
      setShowShareModal(true);
      
      // クリップボードにコピー
      navigator.clipboard.writeText(fullUrl).then(() => {
        console.log('Share URL copied to clipboard (LZ-String compressed)');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Failed to copy URL to clipboard:', err);
      });
      
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      alert('共有URLの生成に失敗しました。');
    }
  };

  // 基本的なAWSサービス（常に表示）
  const basicAwsServices = [
    // Users & Actors
    { id: 'user', name: 'User', color: '#4F46E5', category: 'Actors' },
    { id: 'developer', name: 'Developer', color: '#7C3AED', category: 'Actors' },
    
    // Compute
    { id: 'ec2', name: 'EC2', color: '#FF9900', category: 'Compute' },
    { id: 'lambda', name: 'Lambda', color: '#FF9900', category: 'Compute' },
    { id: 'ecs-fargate', name: 'ECS Fargate', color: '#FF9900', category: 'Compute' },
    
    // Database
    { id: 'rds', name: 'RDS', color: '#527FFF', category: 'Database' },
    { id: 'dynamodb', name: 'DynamoDB', color: '#527FFF', category: 'Database' },
    { id: 'aurora', name: 'Aurora', color: '#527FFF', category: 'Database' },
    { id: 'elasticache', name: 'ElastiCache', color: '#527FFF', category: 'Database' },
    
    // Storage
    { id: 's3', name: 'S3', color: '#569A31', category: 'Storage' },
    { id: 'ecr', name: 'ECR', color: '#569A31', category: 'Storage' },
    
    // Networking
    { id: 'cloudfront', name: 'CloudFront', color: '#FF6B6B', category: 'Networking' },
    { id: 'vpc', name: 'VPC', color: '#FF6B6B', category: 'Networking' },
    { id: 'elb', name: 'ELB', color: '#FF6B6B', category: 'Networking' },
    { id: 'alb', name: 'ALB', color: '#FF6B6B', category: 'Networking' },
    { id: 'route53', name: 'Route 53', color: '#FF6B6B', category: 'Networking' },
    
    // Integration
    { id: 'api-gateway', name: 'API Gateway', color: '#A855F7', category: 'Integration' },
    { id: 'sns', name: 'SNS', color: '#A855F7', category: 'Integration' },
    { id: 'sqs', name: 'SQS', color: '#A855F7', category: 'Integration' },
    
    // Management
    { id: 'cloudwatch', name: 'CloudWatch', color: '#10B981', category: 'Management' },
    { id: 'cloudformation', name: 'CloudFormation', color: '#10B981', category: 'Management' },
    { id: 'systems-manager', name: 'Systems Manager', color: '#10B981', category: 'Management' },
    
    // Security
    { id: 'cognito', name: 'Cognito', color: '#F59E0B', category: 'Security' },
    { id: 'acm', name: 'ACM', color: '#F59E0B', category: 'Security' },
    
    // DevOps
    { id: 'codebuild', name: 'CodeBuild', color: '#6B7280', category: 'DevOps' },
    { id: 'codepipeline', name: 'CodePipeline', color: '#6B7280', category: 'DevOps' },
    { id: 'codedeploy', name: 'CodeDeploy', color: '#6B7280', category: 'DevOps' },
    { id: 'codeconnection', name: 'CodeConnection', color: '#6B7280', category: 'DevOps' },
    { id: 'github', name: 'GitHub', color: '#374151', category: 'DevOps' },
    { id: 'repository', name: 'Repository', color: '#374151', category: 'DevOps' },
    { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' }
  ];

  // 拡張AWSサービス（Advancedモードでのみ表示）
  const advancedAwsServices = [
    // Infrastructure
    { id: 'on-premises', name: 'On-Premises', color: '#6B7280', category: 'Infrastructure' },
    { id: 'data-center', name: 'Data Center', color: '#374151', category: 'Infrastructure' },
    { id: 'corporate-network', name: 'Corporate Network', color: '#4B5563', category: 'Infrastructure' },
    
    // Compute (Advanced)
    { id: 'ecs', name: 'ECS', color: '#FF9900', category: 'Compute' },
    { id: 'eks', name: 'EKS', color: '#FF9900', category: 'Compute' },
    { id: 'batch', name: 'Batch', color: '#FF9900', category: 'Compute' },
    
    // Database (Advanced)
    { id: 'redshift', name: 'Redshift', color: '#527FFF', category: 'Database' },
    { id: 'documentdb', name: 'DocumentDB', color: '#527FFF', category: 'Database' },
    
    // Storage (Advanced)
    { id: 'efs', name: 'EFS', color: '#569A31', category: 'Storage' },
    { id: 'fsx', name: 'FSx', color: '#569A31', category: 'Storage' },
    { id: 'glacier', name: 'Glacier', color: '#569A31', category: 'Storage' },
    
    // Networking (Advanced)
    { id: 'direct-connect', name: 'Direct Connect', color: '#FF6B6B', category: 'Networking' },
    { id: 'transit-gateway', name: 'Transit Gateway', color: '#FF6B6B', category: 'Networking' },
    { id: 'vpc-peering', name: 'VPC Peering', color: '#FF6B6B', category: 'Networking' },
    { id: 'nat-gateway', name: 'NAT Gateway', color: '#FF6B6B', category: 'Networking' },
    { id: 'internet-gateway', name: 'Internet Gateway', color: '#FF6B6B', category: 'Networking' },
    { id: 'vpn-gateway', name: 'VPN Gateway', color: '#FF6B6B', category: 'Networking' },
    { id: 'customer-gateway', name: 'Customer Gateway', color: '#FF6B6B', category: 'Networking' },
    
    // Integration (Advanced)
    { id: 'step-functions', name: 'Step Functions', color: '#A855F7', category: 'Integration' },
    { id: 'eventbridge', name: 'EventBridge', color: '#A855F7', category: 'Integration' },
    { id: 'app-sync', name: 'AppSync', color: '#A855F7', category: 'Integration' },
    
    // Analytics
    { id: 'kinesis', name: 'Kinesis', color: '#8B5CF6', category: 'Analytics' },
    { id: 'kinesis-firehose', name: 'Kinesis Firehose', color: '#8B5CF6', category: 'Analytics' },
    { id: 'kinesis-analytics', name: 'Kinesis Analytics', color: '#8B5CF6', category: 'Analytics' },
    { id: 'glue', name: 'Glue', color: '#8B5CF6', category: 'Analytics' },
    { id: 'athena', name: 'Athena', color: '#8B5CF6', category: 'Analytics' },
    { id: 'emr', name: 'EMR', color: '#8B5CF6', category: 'Analytics' },
    { id: 'opensearch', name: 'OpenSearch', color: '#8B5CF6', category: 'Analytics' },
    { id: 'quicksight', name: 'QuickSight', color: '#8B5CF6', category: 'Analytics' },
    
    // ML/AI
    { id: 'sagemaker', name: 'SageMaker', color: '#EC4899', category: 'ML/AI' },
    { id: 'comprehend', name: 'Comprehend', color: '#EC4899', category: 'ML/AI' },
    { id: 'rekognition', name: 'Rekognition', color: '#EC4899', category: 'ML/AI' },
    { id: 'textract', name: 'Textract', color: '#EC4899', category: 'ML/AI' },
    { id: 'translate', name: 'Translate', color: '#EC4899', category: 'ML/AI' },
    { id: 'polly', name: 'Polly', color: '#EC4899', category: 'ML/AI' },
    { id: 'lex', name: 'Lex', color: '#EC4899', category: 'ML/AI' },
    { id: 'bedrock', name: 'Bedrock', color: '#EC4899', category: 'ML/AI' },
    
    // IoT
    { id: 'iot-core', name: 'IoT Core', color: '#059669', category: 'IoT' },
    { id: 'iot-device-management', name: 'IoT Device Management', color: '#059669', category: 'IoT' },
    { id: 'iot-analytics', name: 'IoT Analytics', color: '#059669', category: 'IoT' },
    { id: 'iot-greengrass', name: 'IoT Greengrass', color: '#059669', category: 'IoT' },
    { id: 'iot-sitewise', name: 'IoT SiteWise', color: '#059669', category: 'IoT' },
    
    // Management (Advanced)
    { id: 'cloudtrail', name: 'CloudTrail', color: '#10B981', category: 'Management' },
    { id: 'config', name: 'Config', color: '#10B981', category: 'Management' },
    { id: 'x-ray', name: 'X-Ray', color: '#10B981', category: 'Management' },
    { id: 'organizations', name: 'Organizations', color: '#10B981', category: 'Management' },
    
    // Security (Advanced)
    { id: 'verified-access', name: 'Verified Access', color: '#F59E0B', category: 'Security' },
    { id: 'iam', name: 'IAM', color: '#F59E0B', category: 'Security' },
    { id: 'kms', name: 'KMS', color: '#F59E0B', category: 'Security' },
    { id: 'secrets-manager', name: 'Secrets Manager', color: '#F59E0B', category: 'Security' },
    { id: 'waf', name: 'WAF', color: '#F59E0B', category: 'Security' },
    { id: 'shield', name: 'Shield', color: '#F59E0B', category: 'Security' },
    { id: 'inspector', name: 'Inspector', color: '#F59E0B', category: 'Security' },
    { id: 'guardduty', name: 'GuardDuty', color: '#F59E0B', category: 'Security' },
    
    // DevOps (Advanced)
    { id: 'codecommit', name: 'CodeCommit', color: '#6B7280', category: 'DevOps' },
    { id: 'codeartifact', name: 'CodeArtifact', color: '#6B7280', category: 'DevOps' },
    { id: 'pull-request', name: 'Pull Request', color: '#3B82F6', category: 'DevOps' },
    { id: 'commit', name: 'Commit', color: '#8B5CF6', category: 'DevOps' }
  ];

  // 表示するサービスを決定
  const awsServices = advancedMode ? [...basicAwsServices, ...advancedAwsServices] : basicAwsServices;

  // コンテナ/枠のテンプレート
  const containerTypes = [
    // Cloud Infrastructure
    { id: 'aws-cloud', name: 'AWS Cloud', color: '#FF9900', borderStyle: 'solid', description: 'AWS Cloud Region' },
    { id: 'vpc', name: 'VPC', color: '#FF6B6B', borderStyle: 'solid', description: 'Virtual Private Cloud' },
    { id: 'subnet', name: 'Subnet', color: '#94A3B8', borderStyle: 'dashed', description: 'Public/Private Subnet' },
    { id: 'security-group', name: 'Security Group', color: '#F87171', borderStyle: 'dotted', description: 'Firewall Rules' },
    { id: 'availability-zone', name: 'Availability Zone', color: '#A78BFA', borderStyle: 'solid', description: 'AZ Boundary' },
    
    // On-Premises Infrastructure
    { id: 'on-premises', name: 'On-Premises', color: '#6B7280', borderStyle: 'solid', description: 'On-Premises Environment' },
    { id: 'data-center', name: 'Data Center', color: '#374151', borderStyle: 'solid', description: 'Physical Data Center' },
    { id: 'corporate-network', name: 'Corporate Network', color: '#4B5563', borderStyle: 'dashed', description: 'Corporate Network Segment' },
    { id: 'server-rack', name: 'Server Rack', color: '#6B7280', borderStyle: 'dotted', description: 'Physical Server Rack' },
    { id: 'network-zone', name: 'Network Zone', color: '#9CA3AF', borderStyle: 'dashed', description: 'Network Security Zone' },
    
    // Application Infrastructure
    { id: 'microservice', name: 'Microservice', color: '#34D399', borderStyle: 'solid', description: 'Service Boundary' },
    { id: 'container', name: 'Container', color: '#60A5FA', borderStyle: 'dashed', description: 'Docker Container' },
    { id: 'namespace', name: 'Namespace', color: '#FBBF24', borderStyle: 'dotted', description: 'K8s Namespace' },
    
    // Development Infrastructure
    { id: 'github', name: 'GitHub', color: '#374151', borderStyle: 'solid', description: 'GitHub Repository' },
    { id: 'repository', name: 'Repository', color: '#374151', borderStyle: 'dashed', description: 'Git Repository' }
  ];

  // アイテムがコンテナ内にあるかチェック
  const isItemInContainer = (itemX, itemY, itemWidth, itemHeight, container) => {
    return (
      itemX >= container.x &&
      itemY >= container.y &&
      itemX + itemWidth <= container.x + container.width &&
      itemY + itemHeight <= container.y + container.height
    );
  };

  // アイテムの親コンテナを見つける（サービスまたはコンテナ用）
  const findParentContainer = (itemX, itemY, itemWidth, itemHeight, excludeContainerId = null) => {
    return containers
      .filter(container => 
        container.id !== excludeContainerId && 
        isItemInContainer(itemX, itemY, itemWidth, itemHeight, container)
      )
      .sort((a, b) => (a.width * a.height) - (b.width * b.height))[0] || null;
  };

  // コンテナの全ての子要素（サービスと子コンテナ）を取得
  const getAllChildrenOfContainer = (containerId) => {
    const children = {
      services: boardItems.filter(item => item.parentContainerId === containerId),
      containers: containers.filter(container => container.parentContainerId === containerId)
    };
    
    // 再帰的に子コンテナの子要素も取得
    children.containers.forEach(childContainer => {
      const grandChildren = getAllChildrenOfContainer(childContainer.id);
      children.services = [...children.services, ...grandChildren.services];
      children.containers = [...children.containers, ...grandChildren.containers];
    });
    
    return children;
  };

  // 循環参照チェック（A が B の子で、B が A の子になることを防ぐ）
  const wouldCreateCircularReference = (childContainerId, parentContainerId) => {
    if (childContainerId === parentContainerId) return true;
    
    const checkParent = (currentParentId) => {
      if (!currentParentId) return false;
      if (currentParentId === childContainerId) return true;
      
      const parent = containers.find(c => c.id === currentParentId);
      return parent ? checkParent(parent.parentContainerId) : false;
    };
    
    return checkParent(parentContainerId);
  };

  // ズームレベル変更
  const changeZoomLevel = (newZoomLevel) => {
    if (newZoomLevel === zoomLevel) return;
    
    // ズーム変更前に履歴保存
    saveToHistory();
    
    const zoomRatio = newZoomLevel / zoomLevel;
    
    // 既存のアイテムの位置をスケール
    setBoardItems(prev => prev.map(item => ({
      ...item,
      x: Math.round(item.x * zoomRatio),
      y: Math.round(item.y * zoomRatio)
    })));
    
    // 既存のコンテナの位置とサイズをスケール
    setContainers(prev => prev.map(container => ({
      ...container,
      x: Math.round(container.x * zoomRatio),
      y: Math.round(container.y * zoomRatio),
      width: Math.round(container.width * zoomRatio),
      height: Math.round(container.height * zoomRatio)
    })));
    
    setZoomLevel(newZoomLevel);
  };
  // マウス位置を追跡
  const handleMouseMove = (e) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const currentMousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setMousePosition(currentMousePos);

    // リサイズ中の処理
    if (resizingContainer && resizeType) {
      const deltaX = currentMousePos.x - resizeStartPos.x;
      const deltaY = currentMousePos.y - resizeStartPos.y;

      setContainers(prev => prev.map(container => {
        if (container.id === resizingContainer) {
          let newWidth = resizeStartSize.width;
          let newHeight = resizeStartSize.height;

          if (resizeType === 'width' || resizeType === 'both') {
            newWidth = Math.max(gridSize * 2, resizeStartSize.width + deltaX);
          }
          if (resizeType === 'height' || resizeType === 'both') {
            newHeight = Math.max(gridSize * 2, resizeStartSize.height + deltaY);
          }

          // グリッドスナップ
          if (snapToGrid) {
            newWidth = Math.round(newWidth / gridSize) * gridSize;
            newHeight = Math.round(newHeight / gridSize) * gridSize;
          }

          return {
            ...container,
            width: newWidth,
            height: newHeight
          };
        }
        return container;
      }));
    }
  };

  const handleContainerDragStart = (e, container) => {
    if (selectedTool !== 'container') return;
    setDraggedItem({ ...container, type: 'container' });
    const rect = e.target.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // 既存コンテナのヘッダードラッグ開始
  const handleExistingContainerDragStart = (e, container) => {
    e.stopPropagation();
    
    // コンテナ内にサービスがある場合は移動を無効化
    const childrenInContainer = getAllChildrenOfContainer(container.id);
    if (childrenInContainer.services.length > 0 || childrenInContainer.containers.length > 0) {
      console.log('コンテナ内にアイテムがあるため移動できません:', 
        childrenInContainer.services.length, '個のサービス,', 
        childrenInContainer.containers.length, '個のコンテナ');
      return; // ドラッグを開始しない
    }
    
    // ドラッグ開始時に履歴保存（移動操作のため）
    saveToHistory();
    
    // コンテナの現在位置を含めてdraggedItemに設定
    const itemWithType = {
      ...container,
      type: 'container',
      originalX: container.x, // 移動前の位置を保存
      originalY: container.y  // 移動前の位置を保存
    };
    
    setDraggedItem(itemWithType);
    
    // ボード上でのマウス位置とコンテナ位置の差分を計算
    const boardRect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - boardRect.left;
    const mouseY = e.clientY - boardRect.top;
    
    setDragOffset({
      x: mouseX - container.x,
      y: mouseY - container.y
    });
  };
  const handleResizeStart = (e, containerId, type) => {
    e.stopPropagation();
    e.preventDefault();
    
    // リサイズ開始時に履歴保存
    saveToHistory();
    
    const container = containers.find(c => c.id === containerId);
    if (!container) return;

    const rect = boardRef.current.getBoundingClientRect();
    setResizingContainer(containerId);
    setResizeType(type);
    setResizeStartPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setResizeStartSize({
      width: container.width,
      height: container.height
    });
  };



  // リサイズ終了
  const handleResizeEnd = () => {
    setResizingContainer(null);
    setResizeType(null);
    setResizeStartPos({ x: 0, y: 0 });
    setResizeStartSize({ width: 0, height: 0 });
  };

  // マウスアップイベントリスナー
  useEffect(() => {
    const handleMouseUp = () => {
      if (resizingContainer) {
        handleResizeEnd();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [resizingContainer]);
  const snapToGridPosition = (x, y) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  };

  // コンテナのサイズを中身に合わせて調整
  const adjustContainerSize = (containerId) => {
    const container = containers.find(c => c.id === containerId);
    const itemsInContainer = boardItems.filter(item => item.parentContainerId === containerId);
    
    if (!container || itemsInContainer.length === 0) return;

    const itemBounds = itemsInContainer.reduce((bounds, item) => ({
      minX: Math.min(bounds.minX, item.x),
      minY: Math.min(bounds.minY, item.y),
      maxX: Math.max(bounds.maxX, item.x + serviceSize),
      maxY: Math.max(bounds.maxY, item.y + serviceSize)
    }), {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    });

    const padding = gridSize;
    const newX = Math.min(container.x, itemBounds.minX - padding);
    const newY = Math.min(container.y, itemBounds.minY - padding);
    const newWidth = Math.max(
      container.width,
      itemBounds.maxX - newX + padding,
      gridSize * 3
    );
    const newHeight = Math.max(
      container.height,
      itemBounds.maxY - newY + padding,
      gridSize * 3
    );

    const snappedSize = snapToGrid ? {
      x: Math.round(newX / gridSize) * gridSize,
      y: Math.round(newY / gridSize) * gridSize,
      width: Math.ceil(newWidth / gridSize) * gridSize,
      height: Math.ceil(newHeight / gridSize) * gridSize
    } : { x: newX, y: newY, width: newWidth, height: newHeight };

    setContainers(prev => prev.map(c => 
      c.id === containerId 
        ? {
            ...c,
            x: snappedSize.x,
            y: snappedSize.y,
            width: snappedSize.width,
            height: snappedSize.height
          }
        : c
    ));

    if (snappedSize.x !== container.x || snappedSize.y !== container.y) {
      setTimeout(() => {
        setBoardItems(prev => prev.map(item => {
          if (item.parentContainerId === containerId) return item;
          const newParent = findParentContainer(item.x, item.y, serviceSize, serviceSize);
          return {
            ...item,
            parentContainerId: newParent?.id || null
          };
        }));
      }, 0);
    }
  };

  // Eraser.io形式からJSONデータに変換（複雑なネスト対応）
  const parseEraserFormat = (mermaidText) => {
    const lines = mermaidText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const items = [];
    const containers = [];
    const connections = [];
    
    let groupStack = []; // ネストしたグループを管理するスタック
    let itemCounter = 0;
    let containerCounter = 0;
    
    // すべてのアイテムIDとコンテナIDのマッピングを保持
    const itemIdMap = new Map(); // originalId -> generatedItem
    const containerIdMap = new Map(); // originalId -> generatedContainer
    
    for (const line of lines) {
      // コメント行をスキップ
      if (line.startsWith('//') || line.startsWith('direction')) {
        continue;
      }
      
      // グループの開始
      if (line.includes('[') && line.includes('icon:') && line.includes('{')) {
        const groupMatch = line.match(/(\w+)\s*\[label:\s*"([^"]+)",?\s*icon:\s*([^\]]+)\]\s*\{/);
        if (groupMatch) {
          const [, groupId, groupName, iconName] = groupMatch;
          const parentContainer = groupStack.length > 0 ? groupStack[groupStack.length - 1] : null;
          
          // コンテナタイプを判定
          let containerType = 'container';
          let borderStyle = 'solid';
          let color = '#FF6B6B';
          
          if (groupName.toLowerCase().includes('vpc')) {
            containerType = 'vpc';
            color = '#FF6B6B';
          } else if (groupName.toLowerCase().includes('subnet')) {
            containerType = 'subnet';
            borderStyle = 'dashed';
            color = '#94A3B8';
          } else if (groupName.toLowerCase().includes('aws') || groupName.toLowerCase().includes('cloud')) {
            containerType = 'aws-cloud';
            color = '#FF9900';
          } else if (groupName.toLowerCase().includes('github')) {
            containerType = 'github';
            color = '#374151';
          } else if (groupName.toLowerCase().includes('on-premises') || groupName.toLowerCase().includes('on premises')) {
            containerType = 'on-premises';
            color = '#6B7280';
          } else if (groupName.toLowerCase().includes('data center') || groupName.toLowerCase().includes('datacenter')) {
            containerType = 'data-center';
            color = '#374151';
          } else if (groupName.toLowerCase().includes('corporate') || groupName.toLowerCase().includes('corp')) {
            containerType = 'corporate-network';
            borderStyle = 'dashed';
            color = '#4B5563';
          } else if (groupName.toLowerCase().includes('rack')) {
            containerType = 'server-rack';
            borderStyle = 'dotted';
            color = '#6B7280';
          } else if (groupName.toLowerCase().includes('network zone') || groupName.toLowerCase().includes('zone')) {
            containerType = 'network-zone';
            borderStyle = 'dashed';
            color = '#9CA3AF';
          }
          
          const newContainer = {
            id: `container-${containerCounter++}-${Date.now()}`,
            name: groupName,
            color: color,
            borderStyle: borderStyle,
            x: 100 + (groupStack.length * 60), // ネストレベルに応じてオフセット
            y: 100 + (groupStack.length * 60),
            width: Math.max(400 - (groupStack.length * 40), 240), // ネストレベルに応じてサイズ調整
            height: Math.max(320 - (groupStack.length * 40), 180),
            parentContainerId: parentContainer?.id || null,
            type: 'container'
          };
          containers.push(newContainer);
          groupStack.push(newContainer);
          containerIdMap.set(groupId, newContainer);
        }
      }
      // グループの終了
      else if (line === '}') {
        if (groupStack.length > 0) {
          groupStack.pop();
        }
      }
      // アイテムの定義（グループ内外両方）
      else if (line.includes('[label:') && line.includes('icon:') && !line.includes('{')) {
        const itemMatch = line.match(/(\w+)\s*\[label:\s*"([^"]+)",?\s*icon:\s*([^\]]+)\]/);
        if (itemMatch) {
          const [, itemId, itemName, iconName] = itemMatch;
          
          // アイコン名とラベル名からAWSサービス名とカテゴリを推定
          const serviceInfo = getServiceFromIcon(iconName.trim(), itemName);
          
          // ユニークなIDを生成
          const uniqueId = `${serviceInfo.id}-${itemCounter++}-${Date.now()}`;
          
          // 現在のグループ（最も内側のネスト）の親コンテナを取得
          const currentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1] : null;
          
          const item = {
            id: uniqueId,
            name: serviceInfo.name,
            customName: itemName !== serviceInfo.name ? itemName : undefined,
            color: serviceInfo.color,
            category: serviceInfo.category,
            x: 180 + (itemCounter % 4) * 100 + (groupStack.length * 30),
            y: 180 + Math.floor(itemCounter / 4) * 100 + (groupStack.length * 30),
            parentContainerId: currentGroup?.id || null,
            type: 'service'
          };
          items.push(item);
          itemIdMap.set(itemId, item);
        }
      }
      // 接続の定義
      else if (line.includes(' > ')) {
        const connectionMatch = line.match(/(\w+)\s*>\s*(\w+)(?:\s*:\s*"([^"]+)")?/);
        if (connectionMatch) {
          const [, fromId, toId, label] = connectionMatch;
          
          // アイテムマップとコンテナマップの両方から検索
          const fromItem = itemIdMap.get(fromId);
          const toItem = itemIdMap.get(toId);
          
          if (fromItem && toItem) {
            connections.push({
              id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              from: fromItem.id,
              to: toItem.id,
              label: label || ''
            });
          }
        }
      }
    }
    
    return { items, containers, connections };
  };

  // アイコン名とラベル名からAWSサービス情報を取得
  const getServiceFromIcon = (iconName, labelName = '') => {
    // まずラベル名から判定
    if (labelName) {
      const labelServiceMap = {
        'User': { id: 'user', name: 'User', color: '#4F46E5', category: 'Actors' },
        'Developer': { id: 'developer', name: 'Developer', color: '#7C3AED', category: 'Actors' },
        'EC2': { id: 'ec2', name: 'EC2', color: '#FF9900', category: 'Compute' },
        'Lambda': { id: 'lambda', name: 'Lambda', color: '#FF9900', category: 'Compute' },
        'ECS Fargate': { id: 'ecs-fargate', name: 'ECS Fargate', color: '#FF9900', category: 'Compute' },
        'ECR': { id: 'ecr', name: 'ECR', color: '#569A31', category: 'Storage' },
        'RDS': { id: 'rds', name: 'RDS', color: '#527FFF', category: 'Database' },
        'DynamoDB': { id: 'dynamodb', name: 'DynamoDB', color: '#527FFF', category: 'Database' },
        'Aurora': { id: 'aurora', name: 'Aurora', color: '#527FFF', category: 'Database' },
        'ElastiCache': { id: 'elasticache', name: 'ElastiCache', color: '#527FFF', category: 'Database' },
        'S3': { id: 's3', name: 'S3', color: '#569A31', category: 'Storage' },
        'VPC': { id: 'vpc', name: 'VPC', color: '#FF6B6B', category: 'Networking' },
        'VPC (staging)': { id: 'vpc', name: 'VPC', color: '#FF6B6B', category: 'Networking' },
        'ALB': { id: 'alb', name: 'ALB', color: '#FF6B6B', category: 'Networking' },
        'Direct Connect': { id: 'direct-connect', name: 'Direct Connect', color: '#FF6B6B', category: 'Networking' },
        'Transit Gateway': { id: 'transit-gateway', name: 'Transit Gateway', color: '#FF6B6B', category: 'Networking' },
        'VPC Peering': { id: 'vpc-peering', name: 'VPC Peering', color: '#FF6B6B', category: 'Networking' },
        'NAT Gateway': { id: 'nat-gateway', name: 'NAT Gateway', color: '#FF6B6B', category: 'Networking' },
        'Internet Gateway': { id: 'internet-gateway', name: 'Internet Gateway', color: '#FF6B6B', category: 'Networking' },
        'VPN Gateway': { id: 'vpn-gateway', name: 'VPN Gateway', color: '#FF6B6B', category: 'Networking' },
        'Customer Gateway': { id: 'customer-gateway', name: 'Customer Gateway', color: '#FF6B6B', category: 'Networking' },
        'On-Premises': { id: 'on-premises', name: 'On-Premises', color: '#6B7280', category: 'Infrastructure' },
        'Data Center': { id: 'data-center', name: 'Data Center', color: '#374151', category: 'Infrastructure' },
        'Corporate Network': { id: 'corporate-network', name: 'Corporate Network', color: '#4B5563', category: 'Infrastructure' },
        'API Gateway': { id: 'api-gateway', name: 'API Gateway', color: '#A855F7', category: 'Integration' },
        'CloudWatch': { id: 'cloudwatch', name: 'CloudWatch', color: '#10B981', category: 'Management' },
        'CodeBuild': { id: 'codebuild', name: 'CodeBuild', color: '#6B7280', category: 'DevOps' },
        'CodePipeline': { id: 'codepipeline', name: 'CodePipeline', color: '#6B7280', category: 'DevOps' },
        'CodeConnection': { id: 'codeconnection', name: 'CodeConnection', color: '#6B7280', category: 'DevOps' },
        'GitHub': { id: 'github', name: 'GitHub', color: '#374151', category: 'DevOps' },
        'Repository': { id: 'repository', name: 'Repository', color: '#374151', category: 'DevOps' },
        'Branch': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
        'Pull Request': { id: 'pull-request', name: 'Pull Request', color: '#3B82F6', category: 'DevOps' },
        'Commit': { id: 'commit', name: 'Commit', color: '#8B5CF6', category: 'DevOps' },
        'main': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
        'develop': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
        'master': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
        'feature': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
        'AWS': { id: 'aws', name: 'AWS Cloud', color: '#FF9900', category: 'Cloud' }
      };
      
      if (labelServiceMap[labelName]) {
        return labelServiceMap[labelName];
      }
    }
    
    // ラベルで見つからない場合はアイコン名から判定
    const iconMap = {
      'user': { id: 'user', name: 'User', color: '#4F46E5', category: 'Actors' },
      
      // Infrastructure
      'on-premises-server': { id: 'on-premises', name: 'On-Premises', color: '#6B7280', category: 'Infrastructure' },
      'data-center': { id: 'data-center', name: 'Data Center', color: '#374151', category: 'Infrastructure' },
      'corporate-network': { id: 'corporate-network', name: 'Corporate Network', color: '#4B5563', category: 'Infrastructure' },
      
      // AWS Cloud & Compute
      'aws-cloud': { id: 'aws', name: 'AWS Cloud', color: '#FF9900', category: 'Cloud' },
      'aws-ec2': { id: 'ec2', name: 'EC2', color: '#FF9900', category: 'Compute' },
      'aws-lambda': { id: 'lambda', name: 'Lambda', color: '#FF9900', category: 'Compute' },
      'aws-fargate': { id: 'ecs-fargate', name: 'ECS Fargate', color: '#FF9900', category: 'Compute' },
      'aws-ecs': { id: 'ecs', name: 'ECS', color: '#FF9900', category: 'Compute' },
      'aws-eks': { id: 'eks', name: 'EKS', color: '#FF9900', category: 'Compute' },
      'aws-batch': { id: 'batch', name: 'Batch', color: '#FF9900', category: 'Compute' },
      
      // Database
      'aws-rds': { id: 'rds', name: 'RDS', color: '#527FFF', category: 'Database' },
      'aws-aurora': { id: 'aurora', name: 'Aurora', color: '#527FFF', category: 'Database' },
      'aws-elasticache': { id: 'elasticache', name: 'ElastiCache', color: '#527FFF', category: 'Database' },
      'aws-dynamodb': { id: 'dynamodb', name: 'DynamoDB', color: '#527FFF', category: 'Database' },
      'aws-redshift': { id: 'redshift', name: 'Redshift', color: '#527FFF', category: 'Database' },
      'aws-documentdb': { id: 'documentdb', name: 'DocumentDB', color: '#527FFF', category: 'Database' },
      
      // Storage
      'aws-simple-storage-service': { id: 's3', name: 'S3', color: '#569A31', category: 'Storage' },
      'aws-elastic-container-registry': { id: 'ecr', name: 'ECR', color: '#569A31', category: 'Storage' },
      'aws-efs': { id: 'efs', name: 'EFS', color: '#569A31', category: 'Storage' },
      'aws-fsx': { id: 'fsx', name: 'FSx', color: '#569A31', category: 'Storage' },
      'aws-glacier': { id: 'glacier', name: 'Glacier', color: '#569A31', category: 'Storage' },
      
      // Networking
      'aws-vpc': { id: 'vpc', name: 'VPC', color: '#FF6B6B', category: 'Networking' },
      'aws-elb-application-load-balancer': { id: 'alb', name: 'ALB', color: '#FF6B6B', category: 'Networking' },
      'aws-elastic-load-balancing': { id: 'elb', name: 'ELB', color: '#FF6B6B', category: 'Networking' },
      'aws-cloudfront': { id: 'cloudfront', name: 'CloudFront', color: '#FF6B6B', category: 'Networking' },
      'aws-route-53': { id: 'route53', name: 'Route 53', color: '#FF6B6B', category: 'Networking' },
      'aws-direct-connect': { id: 'direct-connect', name: 'Direct Connect', color: '#FF6B6B', category: 'Networking' },
      'aws-transit-gateway': { id: 'transit-gateway', name: 'Transit Gateway', color: '#FF6B6B', category: 'Networking' },
      'aws-vpc-peering': { id: 'vpc-peering', name: 'VPC Peering', color: '#FF6B6B', category: 'Networking' },
      'aws-nat-gateway': { id: 'nat-gateway', name: 'NAT Gateway', color: '#FF6B6B', category: 'Networking' },
      'aws-internet-gateway': { id: 'internet-gateway', name: 'Internet Gateway', color: '#FF6B6B', category: 'Networking' },
      'aws-vpn-gateway': { id: 'vpn-gateway', name: 'VPN Gateway', color: '#FF6B6B', category: 'Networking' },
      'aws-customer-gateway': { id: 'customer-gateway', name: 'Customer Gateway', color: '#FF6B6B', category: 'Networking' },
      
      // Integration
      'aws-api-gateway': { id: 'api-gateway', name: 'API Gateway', color: '#A855F7', category: 'Integration' },
      'aws-simple-notification-service': { id: 'sns', name: 'SNS', color: '#A855F7', category: 'Integration' },
      'aws-simple-queue-service': { id: 'sqs', name: 'SQS', color: '#A855F7', category: 'Integration' },
      'aws-step-functions': { id: 'step-functions', name: 'Step Functions', color: '#A855F7', category: 'Integration' },
      'aws-eventbridge': { id: 'eventbridge', name: 'EventBridge', color: '#A855F7', category: 'Integration' },
      'aws-appsync': { id: 'app-sync', name: 'AppSync', color: '#A855F7', category: 'Integration' },
      
      // Management
      'aws-cloudwatch': { id: 'cloudwatch', name: 'CloudWatch', color: '#10B981', category: 'Management' },
      'aws-cloudformation': { id: 'cloudformation', name: 'CloudFormation', color: '#10B981', category: 'Management' },
      'aws-systems-manager': { id: 'systems-manager', name: 'Systems Manager', color: '#10B981', category: 'Management' },
      
      // DevOps
      'aws-codebuild': { id: 'codebuild', name: 'CodeBuild', color: '#6B7280', category: 'DevOps' },
      'aws-codepipeline': { id: 'codepipeline', name: 'CodePipeline', color: '#6B7280', category: 'DevOps' },
      'aws-codestar': { id: 'codeconnection', name: 'CodeConnection', color: '#6B7280', category: 'DevOps' },
      'github': { id: 'github', name: 'GitHub', color: '#374151', category: 'DevOps' },
      'git-repository': { id: 'repository', name: 'Repository', color: '#374151', category: 'DevOps' },
      'git-branch': { id: 'branch', name: 'Branch', color: '#22C55E', category: 'DevOps' },
      'git-pull-request': { id: 'pull-request', name: 'Pull Request', color: '#3B82F6', category: 'DevOps' },
      'git-commit': { id: 'commit', name: 'Commit', color: '#8B5CF6', category: 'DevOps' }
    };
    
    return iconMap[iconName] || { id: 'unknown', name: labelName || 'Unknown Service', color: '#6B7280', category: 'Other' };
  };

  // テキスト形式を判定
  const detectFormat = (text) => {
    if (!text.trim()) return 'unknown';
    
    try {
      const parsed = JSON.parse(text);
      if (parsed.version && parsed.boardItems !== undefined) {
        return 'json';
      }
    } catch {
      // JSON解析失敗
    }
    
    // Eraser.io形式の特徴をチェック（複数パターン対応）
    if (text.includes('direction right') || 
        (text.includes('[label:') && text.includes('icon:')) ||
        text.includes('Group ') ||
        text.includes('[icon:') ||
        (text.includes('{') && text.includes('icon:')) ||
        text.includes('aws-') ||
        text.includes('git-branch')) {
      return 'eraser';
    }
    
    return 'unknown';
  };

  // インポートテキストが変更された時の処理
  const handleImportTextChange = (text) => {
    setImportText(text);
    setDetectedFormat(detectFormat(text));
  };

  // テキストからインポート実行
  const executeImport = () => {
    if (!importText.trim()) {
      alert('Please paste some text to import.');
      return;
    }
    
    const format = detectFormat(importText);
    
    try {
      // インポート前に履歴保存
      saveToHistory();
      
      if (format === 'json') {
        const importData = JSON.parse(importText);
        
        // データを復元
        setBoardItems(importData.boardItems || []);
        setContainers(importData.containers || []);
        setConnections(importData.connections || []);
        
        // 設定を復元（オプション）
        if (importData.settings) {
          setSnapToGrid(importData.settings.snapToGrid ?? snapToGrid);
          setShowGrid(importData.settings.showGrid ?? showGrid);
          setIsDarkMode(importData.settings.isDarkMode ?? isDarkMode);
          setAdvancedMode(importData.settings.advancedMode ?? advancedMode);
        }
      } else if (format === 'eraser') {
        // Eraser.io形式をパース
        const { items, containers, connections } = parseEraserFormat(importText);
        
        setBoardItems(items);
        setContainers(containers);
        setConnections(connections);
      } else {
        alert('Unknown format. Please paste JSON or Eraser.io Mermaid text.');
        return;
      }
      
      // 編集状態をクリア
      setEditingLabel(null);
      setEditingText('');
      setEditingConnectionLabel(null);
      setEditingConnectionText('');
      setConnectionStart(null);
      setIsDrawingConnection(false);
      
      // モーダルを閉じて成功モーダルを表示
      setShowImportModal(false);
      setImportText('');
      setDetectedFormat('unknown');
      setShowSuccessModal(true);
      
      // 5秒後に自動で閉じる
      setTimeout(() => setShowSuccessModal(false), 5000);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import. Please check the format and try again.');
    }
  };

  const handleLabelCancel = () => {
    setEditingLabel(null);
    setEditingText('');
  };

  const handleDragStart = (e, service) => {
    if (selectedTool !== 'service') return;
    setDraggedItem({ ...service, type: 'service' });
    const rect = e.target.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };



  const handleServiceClick = (e, service) => {
    e.stopPropagation();
    const isConnectionAction = e.button === 2 || e.shiftKey || selectedTool === 'connection';
    
    if (isConnectionAction) {
      if (!connectionStart) {
        setConnectionStart(service);
        setIsDrawingConnection(true);
      } else if (connectionStart.id !== service.id) {
        // 接続追加前に履歴保存
        saveToHistory();
        
        const newConnection = {
          id: `conn-${Date.now()}`,
          from: connectionStart.id,
          to: service.id,
          label: ''
        };
        setConnections(prev => [...prev, newConnection]);
        setConnectionStart(null);
        setIsDrawingConnection(false);
      }
    }
  };

  const handleServiceDoubleClick = (e, service) => {
    e.stopPropagation();
    setEditingLabel(service.id);
    setEditingText(service.customName || service.name);
  };

  const handleLabelSubmit = (serviceId) => {
    const currentItem = boardItems.find(item => item.id === serviceId);
    const newName = editingText.trim() || currentItem?.name;
    
    // 変更がある場合のみ履歴保存
    if (currentItem && newName !== (currentItem.customName || currentItem.name)) {
      saveToHistory();
    }
    
    setBoardItems(prev => prev.map(item => 
      item.id === serviceId 
        ? { ...item, customName: newName }
        : item
    ));
    setEditingLabel(null);
    setEditingText('');
  };

  const handleConnectionLabelSubmit = (connectionId) => {
    const currentConnection = connections.find(conn => conn.id === connectionId);
    const newLabel = editingConnectionText.trim();
    
    // 変更がある場合のみ履歴保存
    if (currentConnection && newLabel !== (currentConnection.label || '')) {
      saveToHistory();
    }
    
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId 
        ? { ...conn, label: newLabel }
        : conn
    ));
    setEditingConnectionLabel(null);
    setEditingConnectionText('');
  };

  const handleConnectionLabelCancel = () => {
    setEditingConnectionLabel(null);
    setEditingConnectionText('');
  };

  const handleConnectionLabelKeyDown = (e, connectionId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConnectionLabelSubmit(connectionId);
    } else if (e.key === 'Escape') {
      handleConnectionLabelCancel();
    }
  };

  const handleConnectionDoubleClick = (e, connection) => {
    e.stopPropagation();
    setEditingConnectionLabel(connection.id);
    setEditingConnectionText(connection.label || '');
  };

  const handleLabelKeyDown = (e, serviceId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelSubmit(serviceId);
    } else if (e.key === 'Escape') {
      handleLabelCancel();
    }
  };

  const handleServiceRightClick = (e, service) => {
    e.preventDefault();
    handleServiceClick(e, service);
  };

  const handleBoardClick = (e) => {
    const isConnectionAction = e.button === 2 || e.shiftKey || selectedTool === 'connection';
    
    if (isConnectionAction && connectionStart) {
      setConnectionStart(null);
      setIsDrawingConnection(false);
    }

    if (editingLabel) {
      handleLabelCancel();
    }

    if (editingConnectionLabel) {
      handleConnectionLabelCancel();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleItemDragStart = (e, item) => {
    e.stopPropagation();
    
    // サービスアイテムのドラッグのみ処理
    if (item.type === 'container') return;
    
    // ドラッグ開始時に履歴保存（移動操作のため）
    saveToHistory();
    
    // アイテムにtypeプロパティを追加（インポートしたアイテムの場合）
    const itemWithType = {
      ...item,
      type: item.type || 'service'
    };
    
    setDraggedItem(itemWithType);
    const rect = e.target.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleUnifiedDrop = (e) => {
    e.preventDefault();
    if (!draggedItem || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - boardRect.left - dragOffset.x;
    const y = e.clientY - boardRect.top - dragOffset.y;

    // タイプが設定されていない場合はserviceとして扱う
    const itemType = draggedItem.type || 'service';
    
    const isExistingService = itemType === 'service' && boardItems.some(item => item.id === draggedItem.id);
    const isExistingContainer = itemType === 'container' && containers.some(container => container.id === draggedItem.id);
    const isExisting = isExistingService || isExistingContainer;

    if (itemType === 'service') {
      let finalX = Math.max(0, Math.min(x, boardRect.width - serviceSize));
      let finalY = Math.max(0, Math.min(y, boardRect.height - serviceSize));
      
      const snapped = snapToGridPosition(finalX, finalY);
      finalX = snapped.x;
      finalY = snapped.y;
      
      const parentContainer = findParentContainer(finalX, finalY, serviceSize, serviceSize);
      
      if (isExisting) {
        // 移動の場合は既にhandleItemDragStartで履歴保存済み
        const oldParentId = draggedItem.parentContainerId;
        setBoardItems(prev => prev.map(item => 
          item.id === draggedItem.id 
            ? { 
                ...item, 
                x: finalX,
                y: finalY,
                parentContainerId: parentContainer?.id || null
              }
            : item
        ));
      } else {
        // 新規追加の場合は履歴保存
        saveToHistory();
        
        const newItem = {
          ...draggedItem,
          id: `${draggedItem.id}-${Date.now()}`,
          x: finalX,
          y: finalY,
          parentContainerId: parentContainer?.id || null,
          type: 'service'
        };
        setBoardItems(prev => [...prev, newItem]);
      }
    } else if (itemType === 'container') {
      const containerWidth = draggedItem.width || gridSize * 3;
      const containerHeight = draggedItem.height || gridSize * 3;
      
      let finalX = Math.max(0, Math.min(x, boardRect.width - containerWidth));
      let finalY = Math.max(0, Math.min(y, boardRect.height - containerHeight));
      
      const snapped = snapToGridPosition(finalX, finalY);
      finalX = snapped.x;
      finalY = snapped.y;
      
      // コンテナの親コンテナを見つける（自分自身は除外）
      const parentContainer = findParentContainer(
        finalX, 
        finalY, 
        containerWidth, 
        containerHeight, 
        draggedItem.id
      );
      
      // 循環参照チェック
      const wouldCreateCircle = parentContainer && 
        wouldCreateCircularReference(draggedItem.id, parentContainer.id);
      
      if (wouldCreateCircle) {
        console.log('循環参照が発生するため、ネストできません');
        setDraggedItem(null);
        return;
      }
      
      if (isExisting) {
        // 移動の場合は既にhandleItemDragStartで履歴保存済み
        const deltaX = finalX - draggedItem.x;
        const deltaY = finalY - draggedItem.y;
        
        setContainers(prev => prev.map(container => 
          container.id === draggedItem.id 
            ? { 
                ...container, 
                x: finalX,
                y: finalY,
                parentContainerId: parentContainer?.id || null
              }
            : container
        ));
        
        // 子サービスと子コンテナも一緒に移動
        const allChildren = getAllChildrenOfContainer(draggedItem.id);
        
        setBoardItems(prev => prev.map(item => {
          if (allChildren.services.some(child => child.id === item.id)) {
            const newX = item.x + deltaX;
            const newY = item.y + deltaY;
            const snappedChild = snapToGridPosition(newX, newY);
            return {
              ...item,
              x: snappedChild.x,
              y: snappedChild.y
            };
          }
          return item;
        }));
        
        setContainers(prev => prev.map(container => {
          if (allChildren.containers.some(child => child.id === container.id)) {
            const newX = container.x + deltaX;
            const newY = container.y + deltaY;
            const snappedChild = snapToGridPosition(newX, newY);
            return {
              ...container,
              x: snappedChild.x,
              y: snappedChild.y
            };
          }
          return container;
        }));
        
        setTimeout(() => adjustContainerSize(draggedItem.id), 0);
      } else {
        // 新規追加の場合は履歴保存
        saveToHistory();
        
        const newContainer = {
          ...draggedItem,
          id: `${draggedItem.id}-${Date.now()}`,
          x: finalX,
          y: finalY,
          width: containerWidth,
          height: containerHeight,
          parentContainerId: parentContainer?.id || null,
          type: 'container'
        };
        setContainers(prev => [...prev, newContainer]);
      }
    }
    
    setDraggedItem(null);
  };

  const removeItem = (itemId) => {
    // 削除前に履歴保存
    saveToHistory();
    
    setBoardItems(prev => prev.filter(item => item.id !== itemId));
    setConnections(prev => prev.filter(conn => conn.from !== itemId && conn.to !== itemId));
  };

  const removeContainer = (containerId) => {
    // 削除前に履歴保存
    saveToHistory();
    
    // 削除するコンテナの全ての子要素を取得
    const allChildren = getAllChildrenOfContainer(containerId);
    
    // 子コンテナも再帰的に削除
    const containerIdsToRemove = [containerId, ...allChildren.containers.map(c => c.id)];
    
    setContainers(prev => prev.filter(container => !containerIdsToRemove.includes(container.id)));
    
    // 子サービスの親コンテナをクリア
    setBoardItems(prev => prev.map(item => ({
      ...item,
      parentContainerId: allChildren.services.some(s => s.id === item.id) ? null : item.parentContainerId
    })));
  };

  const removeConnection = (connectionId) => {
    // 削除前に履歴保存
    saveToHistory();
    
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  };

  const clearBoard = () => {
    // クリア前に履歴保存
    saveToHistory();
    
    setBoardItems([]);
    setContainers([]);
    setConnections([]);
    setConnectionStart(null);
    setIsDrawingConnection(false);
    setEditingLabel(null);
    setEditingText('');
    setEditingConnectionLabel(null);
    setEditingConnectionText('');
    
    // Undo履歴もクリア
    setUndoHistory([]);
  };

  // AWSサービス名をeraser.ioのアイコン名にマッピング
  const getEraserIconName = (serviceName) => {
    const logoMap = {
      // Actors
      'User': 'user',
      'Developer': 'user',
      
      // Compute
      'EC2': 'aws-ec2',
      'Lambda': 'aws-lambda',
      'ECS': 'aws-elastic-container-service',
      'ECS Fargate': 'aws-fargate',
      'ECR': 'aws-elastic-container-registry',
      'EKS': 'aws-elastic-kubernetes-service',
      'Batch': 'aws-batch',
      
      // Database
      'RDS': 'aws-rds',
      'DynamoDB': 'aws-dynamodb',
      'Aurora': 'aws-aurora',
      'ElastiCache': 'aws-elasticache',
      'Redshift': 'aws-redshift',
      'DocumentDB': 'aws-documentdb',
      
      // Storage
      'S3': 'aws-simple-storage-service',
      'ECR': 'aws-elastic-container-registry',
      'EFS': 'aws-efs',
      'FSx': 'aws-fsx',
      'Glacier': 'aws-simple-storage-service-glacier',
      
      // Infrastructure
      'On-Premises': 'on-premises-server',
      'Data Center': 'data-center',
      'Corporate Network': 'corporate-network',
      
      // Networking
      'CloudFront': 'aws-cloudfront',
      'VPC': 'aws-vpc',
      'ELB': 'aws-elastic-load-balancing',
      'ALB': 'aws-elb-application-load-balancer',
      'Route 53': 'aws-route-53',
      'Direct Connect': 'aws-direct-connect',
      'Transit Gateway': 'aws-transit-gateway',
      'VPC Peering': 'aws-vpc-peering',
      'NAT Gateway': 'aws-nat-gateway',
      'Internet Gateway': 'aws-internet-gateway',
      'VPN Gateway': 'aws-vpn-gateway',
      'Customer Gateway': 'aws-customer-gateway',
      
      // Integration
      'API Gateway': 'aws-api-gateway',
      'SNS': 'aws-simple-notification-service',
      'SQS': 'aws-simple-queue-service',
      'Step Functions': 'aws-step-functions',
      'EventBridge': 'aws-eventbridge',
      'AppSync': 'aws-appsync',
      
      // Management & Monitoring
      'CloudWatch': 'aws-cloudwatch',
      'CloudFormation': 'aws-cloudformation',
      'CloudTrail': 'aws-cloudtrail',
      'Config': 'aws-config',
      'Systems Manager': 'aws-systems-manager',
      'X-Ray': 'aws-x-ray',
      'Organizations': 'aws-organizations',
      
      // Security
      'Cognito': 'aws-cognito',
      'ACM': 'aws-certificate-manager',
      'IAM': 'aws-identity-and-access-management',
      'KMS': 'aws-key-management-service',
      'Secrets Manager': 'aws-secrets-manager',
      'WAF': 'aws-waf',
      'Shield': 'aws-shield',
      'Inspector': 'aws-inspector',
      'GuardDuty': 'aws-guardduty',
      'Verified Access': 'aws-verified-access',
      
      // Analytics
      'Kinesis': 'aws-kinesis',
      'Kinesis Firehose': 'aws-kinesis-firehose',
      'Kinesis Analytics': 'aws-kinesis-data-analytics',
      'Glue': 'aws-glue',
      'Athena': 'aws-athena',
      'EMR': 'aws-emr',
      'OpenSearch': 'aws-opensearch-service',
      'QuickSight': 'aws-quicksight',
      
      // ML/AI
      'SageMaker': 'aws-sagemaker',
      'Comprehend': 'aws-comprehend',
      'Rekognition': 'aws-rekognition',
      'Textract': 'aws-textract',
      'Translate': 'aws-translate',
      'Polly': 'aws-polly',
      'Lex': 'aws-lex',
      'Bedrock': 'aws-bedrock',
      
      // IoT
      'IoT Core': 'aws-iot-core',
      'IoT Device Management': 'aws-iot-device-management',
      'IoT Analytics': 'aws-iot-analytics',
      'IoT Greengrass': 'aws-iot-greengrass',
      'IoT SiteWise': 'aws-iot-sitewise',
      
      // DevOps
      'CodeBuild': 'aws-codebuild',
      'CodePipeline': 'aws-codepipeline',
      'CodeDeploy': 'aws-codedeploy',
      'CodeCommit': 'aws-codecommit',
      'CodeArtifact': 'aws-codeartifact',
      'CodeConnection': 'aws-codestar',
      'GitHub': 'github'
    };
    return logoMap[serviceName] || 'aws-ec2';
  };

  const exportMermaidToClipboard = async () => {
    let mermaidCode = '';
    
    if (exportFormat === 'eraser') {
      // eraser.io形式
      mermaidCode = 'direction right\n\n';
      
      // グループなしのアイテムを先に定義
      const itemsNotInContainer = boardItems.filter(item => !item.parentContainerId);
      itemsNotInContainer.forEach(item => {
        const nodeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
        const nodeName = item.customName || item.name;
        const iconName = getEraserIconName(item.name);
        mermaidCode += `${nodeId} [label: "${nodeName}", icon: ${iconName}]\n`;
      });
      
      if (itemsNotInContainer.length > 0) {
        mermaidCode += '\n';
      }
      
      // ネストされたグループを再帰的に出力
      const exportContainerRecursive = (containerId, depth = 0) => {
        const container = containers.find(c => c.id === containerId);
        if (!container) return '';
        
        const containerId_clean = container.id.replace(/[^a-zA-Z0-9]/g, '_');
        const containerName = container.name;
        const itemsInContainer = boardItems.filter(item => item.parentContainerId === container.id);
        const childContainers = containers.filter(c => c.parentContainerId === container.id);
        
        let containerCode = '';
        
        // コンテナのアイコンを決定
        let groupIcon = 'aws-vpc';
        if (containerName.toLowerCase().includes('aws') || containerName.toLowerCase().includes('cloud')) {
          groupIcon = 'aws-cloud';
        } else if (containerName.toLowerCase().includes('github')) {
          groupIcon = 'github';
        } else if (itemsInContainer.length > 0) {
          groupIcon = getEraserIconName(itemsInContainer[0].name);
        }
        
        containerCode += `${'  '.repeat(depth)}${containerId_clean} [label: "${containerName}", icon: ${groupIcon}] {\n`;
        
        // コンテナ内のサービスを出力
        itemsInContainer.forEach(item => {
          const nodeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
          const nodeName = item.customName || item.name;
          const iconName = getEraserIconName(item.name);
          containerCode += `${'  '.repeat(depth + 1)}${nodeId} [label: "${nodeName}", icon: ${iconName}]\n`;
        });
        
        // 子コンテナを再帰的に出力
        childContainers.forEach(childContainer => {
          containerCode += exportContainerRecursive(childContainer.id, depth + 1);
        });
        
        containerCode += `${'  '.repeat(depth)}}\n`;
        
        return containerCode;
      };
      
      // ルートレベルのコンテナから開始
      const rootContainers = containers.filter(container => !container.parentContainerId);
      rootContainers.forEach(container => {
        mermaidCode += exportContainerRecursive(container.id);
        mermaidCode += '\n'; // 各ルートコンテナの後に空行を追加
      });
      
      // 接続を定義
      if (connections.length > 0) {
        mermaidCode += '// Connections\n';
        connections.forEach(connection => {
          const fromId = connection.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = connection.to.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (connection.label && connection.label.trim()) {
            mermaidCode += `${fromId} > ${toId} : "${connection.label}"\n`;
          } else {
            mermaidCode += `${fromId} > ${toId}\n`;
          }
        });
      }
    } else {
      // 従来のflowchart形式（ネスト対応）
      mermaidCode = 'flowchart TD\n';
      
      // コンテナに含まれていないアイテムを先に定義
      const itemsNotInContainer = boardItems.filter(item => !item.parentContainerId);
      itemsNotInContainer.forEach(item => {
        const nodeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
        const nodeName = item.customName || item.name;
        mermaidCode += `    ${nodeId}["${nodeName}"]\n`;
      });
      
      // ネストされたコンテナを再帰的に出力
      const exportFlowchartContainerRecursive = (containerId, depth = 1) => {
        const container = containers.find(c => c.id === containerId);
        if (!container) return '';
        
        const containerId_clean = container.id.replace(/[^a-zA-Z0-9]/g, '_');
        const containerName = container.name;
        const itemsInContainer = boardItems.filter(item => item.parentContainerId === container.id);
        const childContainers = containers.filter(c => c.parentContainerId === container.id);
        
        let containerCode = '';
        const indent = '    '.repeat(depth);
        
        containerCode += `\n${indent}subgraph ${containerId_clean}["${containerName}"]\n`;
        
        // コンテナ内のサービスを出力
        itemsInContainer.forEach(item => {
          const nodeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
          const nodeName = item.customName || item.name;
          containerCode += `${indent}    ${nodeId}["${nodeName}"]\n`;
        });
        
        // 子コンテナを再帰的に出力
        childContainers.forEach(childContainer => {
          containerCode += exportFlowchartContainerRecursive(childContainer.id, depth + 1);
        });
        
        containerCode += `${indent}end\n`;
        
        return containerCode;
      };
      
      // ルートレベルのコンテナから開始
      const rootContainers = containers.filter(container => !container.parentContainerId);
      rootContainers.forEach(container => {
        mermaidCode += exportFlowchartContainerRecursive(container.id);
      });
      
      if (connections.length > 0) {
        mermaidCode += '\n    %% Connections\n';
        connections.forEach(connection => {
          const fromId = connection.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = connection.to.replace(/[^a-zA-Z0-9]/g, '_');
          if (connection.label && connection.label.trim()) {
            mermaidCode += `    ${fromId} -->|"${connection.label}"| ${toId}\n`;
          } else {
            mermaidCode += `    ${fromId} --> ${toId}\n`;
          }
        });
      }
      
      mermaidCode += '\n    %% Styling\n';
      boardItems.forEach(item => {
        const nodeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
        const color = item.color;
        mermaidCode += `    style ${nodeId} fill:${color},stroke:#333,stroke-width:2px,color:#fff\n`;
      });
    }
    
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setShowCopyModal(true);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      const textArea = document.createElement('textarea');
      textArea.value = mermaidCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowCopyModal(true);
    }
    
    setTimeout(() => setShowCopyModal(false), 3000);
  };

  const groupedServices = awsServices.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {});

  const getBorderStyle = (borderType) => {
    switch (borderType) {
      case 'dashed': return '2px dashed';
      case 'dotted': return '2px dotted';
      default: return '2px solid';
    }
  };

  const getServiceConnectionPoints = (serviceId) => {
    const service = boardItems.find(item => item.id === serviceId);
    if (!service) return { top: { x: 0, y: 0 }, bottom: { x: 0, y: 0 }, left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    
    const centerX = service.x + serviceSize / 2;
    const centerY = service.y + serviceSize / 2;
    
    return {
      top: { x: centerX, y: service.y },
      bottom: { x: centerX, y: service.y + serviceSize },
      left: { x: service.x, y: centerY },
      right: { x: service.x + serviceSize, y: centerY }
    };
  };

  const getOptimalConnectionPoints = (fromServiceId, toServiceId) => {
    const fromPoints = getServiceConnectionPoints(fromServiceId);
    const toPoints = getServiceConnectionPoints(toServiceId);
    
    let minDistance = Infinity;
    let bestFromPoint = fromPoints.right;
    let bestToPoint = toPoints.left;
    
    Object.entries(fromPoints).forEach(([fromKey, fromPoint]) => {
      Object.entries(toPoints).forEach(([toKey, toPoint]) => {
        const distance = Math.sqrt(
          Math.pow(fromPoint.x - toPoint.x, 2) + 
          Math.pow(fromPoint.y - toPoint.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestFromPoint = fromPoint;
          bestToPoint = toPoint;
        }
      });
    });
    
    return { from: bestFromPoint, to: bestToPoint };
  };

  // スクロールバーのスタイルを動的に適用
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Webkit-based browsers (Chrome, Safari, Edge) */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: ${isDarkMode ? '#374151' : '#f3f4f6'};
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: ${isDarkMode ? '#6b7280' : '#d1d5db'};
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: ${isDarkMode ? '#9ca3af' : '#9ca3af'};
      }
      
      ::-webkit-scrollbar-corner {
        background: ${isDarkMode ? '#374151' : '#f3f4f6'};
      }
      
      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: ${isDarkMode ? '#6b7280 #374151' : '#d1d5db #f3f4f6'};
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [isDarkMode]);

  return (
    <div className={`flex h-screen font-system ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* サイドバー */}
      <div className={`w-80 border-r overflow-y-auto shadow-sm ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className="mb-6">
            <h2 className={`text-xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>otak-aws</h2>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>AWS Architecture Tool</p>
          </div>
          
          {/* ツール選択 */}
          <div className="mb-6">
            <h3 className={`text-sm font-medium mb-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Tools</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setSelectedTool('service')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  selectedTool === 'service' 
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300 shadow-sm border border-blue-700'
                      : 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : isDarkMode
                      ? 'text-gray-400 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Box size={18} />
                <span className="font-medium">Services</span>
              </button>
              <button
                onClick={() => setSelectedTool('container')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  selectedTool === 'container' 
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300 shadow-sm border border-blue-700'
                      : 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : isDarkMode
                      ? 'text-gray-400 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Square size={18} />
                <span className="font-medium">Containers</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('connection');
                  setConnectionStart(null);
                  setIsDrawingConnection(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  selectedTool === 'connection' 
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300 shadow-sm border border-blue-700'
                      : 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : isDarkMode
                      ? 'text-gray-400 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 border-2 border-current rounded"></div>
                <span className="font-medium">Connections</span>
              </button>
            </div>
            {selectedTool === 'connection' && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                isDarkMode 
                  ? 'bg-blue-900 bg-opacity-30 text-blue-300'
                  : 'bg-blue-50 text-blue-700'
              }`}>
                Click two services to create a connection
              </div>
            )}
          </div>

          {/* Advanced Mode Toggle */}
          <div className="mb-8">
            <button
              onClick={() => setAdvancedMode(!advancedMode)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border font-medium ${
                advancedMode 
                  ? isDarkMode
                    ? 'bg-purple-900 bg-opacity-50 text-purple-300 border-purple-700'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  advancedMode ? 'border-current' : 'border-current'
                }`}>
                  {advancedMode && <div className="w-2 h-2 bg-current rounded-full"></div>}
                </div>
                <span>Advanced Mode</span>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full ${
                advancedMode 
                  ? isDarkMode
                    ? 'bg-purple-800 text-purple-200'
                    : 'bg-purple-100 text-purple-600'
                  : isDarkMode
                    ? 'bg-gray-600 text-gray-400'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {advancedMode ? 'ON' : 'OFF'}
              </div>
            </button>
            <div className={`mt-2 text-xs ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {advancedMode 
                ? `Showing ${awsServices.length} services (Analytics, ML/AI, IoT, etc.)`
                : `Showing ${basicAwsServices.length} basic services + Users & ECR`}</div>
          </div>

          {/* サービス一覧 */}
          {selectedTool === 'service' && (
            <>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                AWS Services 
                {advancedMode && (
                  <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                    isDarkMode 
                      ? 'bg-purple-900 bg-opacity-50 text-purple-300'
                      : 'bg-purple-100 text-purple-600'
                  }`}>
                    Advanced
                  </span>
                )}
              </h3>
              {Object.entries(groupedServices).map(([category, services]) => (
                <div key={category} className="mb-6">
                  <h4 className={`text-sm font-medium mb-3 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {services.map(service => (
                      <div
                        key={service.id}
                        draggable={selectedTool === 'service'}
                        onDragStart={(e) => handleDragStart(e, service)}
                        className={`flex flex-col items-center p-3 border rounded-xl transition-all cursor-grab active:cursor-grabbing ${
                          selectedTool === 'service' 
                            ? isDarkMode
                              ? 'bg-gray-700 border-gray-600 hover:shadow-md hover:border-gray-500 opacity-100'
                              : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300 opacity-100'
                            : 'cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div 
                          className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center text-white font-semibold text-xs shadow-sm"
                          style={{ backgroundColor: service.color }}
                        >
                          {(() => {
                            const customAbbreviations = {
                              // Infrastructure
                              'On-Premises': 'ON-P',
                              'Data Center': 'DC',
                              'Corporate Network': 'CORP',
                              
                              // Actors
                              'User': 'USR',
                              'Developer': 'DEV',
                              
                              // Networking (Expanded)
                              'Direct Connect': 'DX',
                              'Transit Gateway': 'TGW',
                              'VPC Peering': 'PCR',
                              'NAT Gateway': 'NAT',
                              'Internet Gateway': 'IGW',
                              'VPN Gateway': 'VGW',
                              'Customer Gateway': 'CGW',
                              
                              // DevOps
                              'CodeBuild': 'CB',
                              'CodePipeline': 'CP',
                              'CodeDeploy': 'CD',
                              'CodeConnection': 'CC',
                              'CodeCommit': 'CM',
                              'CodeArtifact': 'CA',
                              'GitHub': 'GIT',
                              'Repository': 'REPO',
                              'Branch': 'BR',
                              'Pull Request': 'PR',
                              'Commit': 'COM',
                              
                              // Integration
                              'Step Functions': 'SF',
                              'EventBridge': 'EB',
                              'AppSync': 'AS',
                              'API Gateway': 'AG',
                              
                              // Analytics
                              'Kinesis Firehose': 'KF',
                              'Kinesis Analytics': 'KA',
                              'OpenSearch': 'OS',
                              'QuickSight': 'QS',
                              
                              // ML/AI
                              'SageMaker': 'SM',
                              'Comprehend': 'COM',
                              'Rekognition': 'RK',
                              'Textract': 'TX',
                              'Translate': 'TR',
                              'Bedrock': 'BR',
                              
                              // IoT
                              'IoT Core': 'IC',
                              'IoT Device Management': 'IDM',
                              'IoT Analytics': 'IA',
                              'IoT Greengrass': 'IGG',
                              'IoT SiteWise': 'ISW',
                              
                              // Management
                              'CloudFormation': 'CF',
                              'CloudTrail': 'CT',
                              'CloudWatch': 'CW',
                              'Systems Manager': 'SSM',
                              'X-Ray': 'XR',
                              'Organizations': 'ORG',
                              
                              // Security
                              'ACM': 'ACM',
                              'Secrets Manager': 'SEC',
                              'GuardDuty': 'GD',
                              'Verified Access': 'VA',
                              
                              // Networking
                              'Route 53': 'R53',
                              'Direct Connect': 'DC',
                              
                              // Compute
                              'ECS Fargate': 'FG',
                              'ECR': 'ECR',
                              
                              // Database
                              'DocumentDB': 'DOC',
                              'ElastiCache': 'EC'
                            };
                            
                            if (customAbbreviations[service.name]) {
                              return customAbbreviations[service.name];
                            }
                            
                            return service.name.length <= 3 ? service.name.toUpperCase() : 
                                   service.name.includes(' ') ? 
                                   service.name.split(' ').map(word => word[0]).join('').toUpperCase() :
                                   service.name.substring(0, 2).toUpperCase();
                          })()}
                        </div>
                        <span className={`text-xs text-center font-medium leading-tight ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-700'
                        }`}>{service.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* コンテナ一覧 */}
          {selectedTool === 'container' && (
            <>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Containers</h3>
              <div className="space-y-3">
                {containerTypes.map(container => (
                  <div
                    key={container.id}
                    draggable={selectedTool === 'container'}
                    onDragStart={(e) => handleContainerDragStart(e, container)}
                    className={`flex items-center p-4 border rounded-xl transition-all cursor-grab hover:shadow-md active:cursor-grabbing ${
                      selectedTool === 'container' 
                        ? isDarkMode
                          ? 'bg-gray-700 border-gray-600 hover:border-gray-500 opacity-100'
                          : 'bg-white border-gray-200 hover:border-gray-300 opacity-100'
                        : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg mr-3 flex items-center justify-center text-white font-semibold text-xs shadow-sm"
                      style={{ 
                        backgroundColor: container.color,
                        border: getBorderStyle(container.borderStyle).replace('2px', '2px')
                      }}
                    >
                      {container.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium text-sm ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>{container.name}</div>
                      <div className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>{container.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 接続一覧 */}
          {selectedTool === 'connection' && (
            <>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Connections</h3>
              <div className="space-y-2">
                {connections.map(connection => {
                  const fromService = boardItems.find(item => item.id === connection.from);
                  const toService = boardItems.find(item => item.id === connection.to);
                  return (
                    <div key={connection.id} className={`flex items-center justify-between p-3 border rounded-lg ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-white border-gray-200'
                    }`}>
                      <div className={`text-xs flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div>
                          <span className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            {fromService?.customName || fromService?.name}
                          </span>
                          <span className={`mx-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>→</span>
                          <span className={`font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            {toService?.customName || toService?.name}
                          </span>
                        </div>
                        {connection.label && (
                          <div className={`text-xs mt-1 italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            "{connection.label}"
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeConnection(connection.id)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ml-2 ${
                          isDarkMode
                            ? 'bg-red-900 bg-opacity-50 hover:bg-red-900 hover:bg-opacity-70 text-red-400'
                            : 'bg-red-50 hover:bg-red-100 text-red-600'
                        }`}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
                {connections.length === 0 && (
                  <div className={`text-xs text-center py-6 rounded-lg ${
                    isDarkMode 
                      ? 'text-gray-500 bg-gray-800' 
                      : 'text-gray-500 bg-gray-50'
                  }`}>
                    No connections yet
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col">
        {/* ツールバー */}
        <div className={`border-b px-6 py-4 shadow-sm ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-end">

            <div className="flex gap-3">
              {/* ズームコントロール */}
              <div className="flex gap-1">
                <button
                  onClick={() => changeZoomLevel(50)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border font-medium text-sm ${
                    zoomLevel === 50
                      ? isDarkMode
                        ? 'bg-green-900 bg-opacity-50 text-green-300 border-green-700'
                        : 'bg-green-50 text-green-700 border-green-200'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Overview zoom (40px grid)"
                >
                  <div className="w-1.5 h-1.5 border border-current rounded"></div>
                  50%
                </button>
                <button
                  onClick={() => changeZoomLevel(75)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border font-medium text-sm ${
                    zoomLevel === 75
                      ? isDarkMode
                        ? 'bg-yellow-900 bg-opacity-50 text-yellow-300 border-yellow-700'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Compact zoom (60px grid)"
                >
                  <div className="w-2 h-2 border border-current rounded"></div>
                  75%
                </button>
                <button
                  onClick={() => changeZoomLevel(100)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border font-medium text-sm ${
                    zoomLevel === 100
                      ? isDarkMode
                        ? 'bg-blue-900 bg-opacity-50 text-blue-300 border-blue-700'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Normal zoom (80px grid)"
                >
                  <div className="w-3 h-3 border border-current rounded"></div>
                  100%
                </button>
              </div>
              
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
                title="Toggle dark mode"
              >
                {isDarkMode ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
                {isDarkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                  showGrid 
                    ? isDarkMode
                      ? 'bg-green-900 bg-opacity-50 text-green-300 border-green-700'
                      : 'bg-green-50 text-green-700 border-green-200'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
                title="Toggle grid display"
              >
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                  <div className="bg-current rounded-sm opacity-60"></div>
                  <div className="bg-current rounded-sm opacity-60"></div>
                  <div className="bg-current rounded-sm opacity-60"></div>
                  <div className="bg-current rounded-sm opacity-60"></div>
                </div>
                Grid
              </button>
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                  snapToGrid 
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300 border-blue-700'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
                title="Toggle grid snap"
              >
                <div className="w-4 h-4 border-2 border-current rounded flex items-center justify-center">
                  {snapToGrid && <div className="w-2 h-2 bg-current rounded"></div>}
                </div>
                Snap
              </button>
              <button
                onClick={clearBoard}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                  isDarkMode
                    ? 'bg-red-900 bg-opacity-50 text-red-300 border-red-700 hover:bg-red-900 hover:bg-opacity-70'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                <RotateCcw size={16} />
                Clear
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowImportModal(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                    isDarkMode
                      ? 'bg-green-900 bg-opacity-50 text-green-300 border-green-700 hover:bg-green-900 hover:bg-opacity-70'
                      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  }`}
                  title="Import from JSON or Eraser.io Mermaid text"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Import
                </button>
                <button
                  onClick={() => {
                    const formats = ['eraser', 'flowchart'];
                    const currentIndex = formats.indexOf(exportFormat);
                    const nextIndex = (currentIndex + 1) % formats.length;
                    setExportFormat(formats[nextIndex]);
                  }}
                  className={`flex items-center gap-1 px-2 py-2 rounded-lg transition-all border font-medium text-xs ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={`Switch format (current: ${exportFormat})`}
                >
                  <div className="w-3 h-3 border border-current rounded"></div>
                  {exportFormat === 'eraser' ? 'E' : 'F'}
                </button>
                <button
                  onClick={exportMermaidToClipboard}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                    isDarkMode
                      ? 'bg-purple-900 bg-opacity-50 text-purple-300 border-purple-700 hover:bg-purple-900 hover:bg-opacity-70'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}
                  title={`Export as ${exportFormat === 'eraser' ? 'eraser.io' : 'flowchart'} format`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2m-2 0v4l3-3m0 0l-3-3m3 3H9m11-11V9a2 2 0 01-2 2m-2 0V6a2 2 0 00-2-2V2" />
                  </svg>
                  Export
                </button>
                <button
                  onClick={handleGenerateShareUrl}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border font-medium ${
                    isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300 border-blue-700 hover:bg-blue-900 hover:bg-opacity-70'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                  title="Share current architecture via URL"
                >
                  <Share size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* キャンバスエリア */}
        <div
          ref={boardRef}
          className={`flex-1 relative overflow-hidden ${
            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
          }`}
          style={{
            backgroundImage: showGrid ? `
              linear-gradient(${isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(156, 163, 175, 0.2)'} 1px, transparent 1px),
              linear-gradient(90deg, ${isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(156, 163, 175, 0.2)'} 1px, transparent 1px)
            ` : 'none',
            backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : 'auto'
          }}
          onDragOver={handleDragOver}
          onDrop={handleUnifiedDrop}
          onMouseMove={handleMouseMove}
          onClick={handleBoardClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* SVGで接続線を描画 */}
          <svg 
            className="absolute inset-0 pointer-events-none" 
            style={{ zIndex: 50, width: '100%', height: '100%' }}
            width="100%" 
            height="100%"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={isDarkMode ? "#D1D5DB" : "#6B7280"}
                />
              </marker>
            </defs>
            
            {/* 既存の接続線 */}
            {connections.map(connection => {
              const connectionPoints = getOptimalConnectionPoints(connection.from, connection.to);
              const midX = (connectionPoints.from.x + connectionPoints.to.x) / 2;
              const midY = (connectionPoints.from.y + connectionPoints.to.y) / 2;
              
              return (
                <g key={connection.id}>
                  {/* クリック可能な透明な太い線 */}
                  <line
                    x1={connectionPoints.from.x}
                    y1={connectionPoints.from.y}
                    x2={connectionPoints.to.x}
                    y2={connectionPoints.to.y}
                    stroke="transparent"
                    strokeWidth="12"
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onDoubleClick={(e) => handleConnectionDoubleClick(e, connection)}
                  />
                  {/* 実際に見える線 */}
                  <line
                    x1={connectionPoints.from.x}
                    y1={connectionPoints.from.y}
                    x2={connectionPoints.to.x}
                    y2={connectionPoints.to.y}
                    stroke={isDarkMode ? "#D1D5DB" : "#9CA3AF"}
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* ラベル */}
                  {editingConnectionLabel === connection.id ? (
                    <foreignObject
                      x={midX - 40}
                      y={midY - 10}
                      width="80"
                      height="20"
                    >
                      <input
                        type="text"
                        value={editingConnectionText}
                        onChange={(e) => setEditingConnectionText(e.target.value)}
                        onBlur={() => handleConnectionLabelSubmit(connection.id)}
                        onKeyDown={(e) => handleConnectionLabelKeyDown(e, connection.id)}
                        className={`w-full text-xs text-center border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-500 text-gray-100 focus:border-blue-400'
                            : 'bg-white border-blue-300 text-gray-900'
                        }`}
                        autoFocus
                        style={{ fontSize: '10px' }}
                      />
                    </foreignObject>
                  ) : connection.label ? (
                    <g>
                      {/* ラベル背景 */}
                      <rect
                        x={midX - (connection.label.length * 3.5)}
                        y={midY - 8}
                        width={connection.label.length * 7}
                        height={16}
                        fill={isDarkMode ? "#374151" : "white"}
                        stroke={isDarkMode ? "#6B7280" : "#9CA3AF"}
                        strokeWidth="1"
                        rx="3"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* ラベルテキスト */}
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fontSize="10"
                        fill={isDarkMode ? "#E5E7EB" : "#374151"}
                        fontWeight="500"
                        style={{ pointerEvents: 'none' }}
                      >
                        {connection.label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
            
            {/* 描画中の接続線 */}
            {isDrawingConnection && connectionStart && (
              <g>
                {(() => {
                  const startPoints = getServiceConnectionPoints(connectionStart.id);
                  let closestPoint = startPoints.right;
                  let minDistance = Infinity;
                  
                  Object.values(startPoints).forEach(point => {
                    const distance = Math.sqrt(
                      Math.pow(point.x - mousePosition.x, 2) + 
                      Math.pow(point.y - mousePosition.y, 2)
                    );
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestPoint = point;
                    }
                  });
                  
                  return (
                    <line
                      x1={closestPoint.x}
                      y1={closestPoint.y}
                      x2={mousePosition.x}
                      y2={mousePosition.y}
                      stroke={isDarkMode ? "#60A5FA" : "#3B82F6"}
                      strokeWidth="2"
                      strokeDasharray="8,4"
                      opacity="0.7"
                    />
                  );
                })()}
              </g>
            )}
          </svg>

          {/* 配置されたコンテナ（ネスト順にレンダリング） */}
          {(() => {
            // コンテナの深度を計算してソート
            const getContainerDepth = (containerId) => {
              const container = containers.find(c => c.id === containerId);
              if (!container || !container.parentContainerId) return 0;
              return 1 + getContainerDepth(container.parentContainerId);
            };
            
            // 深度順にコンテナをソート（浅い順から深い順）
            const sortedContainers = [...containers].sort((a, b) => 
              getContainerDepth(a.id) - getContainerDepth(b.id)
            );
            
            return sortedContainers.map(container => {
              const depth = getContainerDepth(container.id);
              const parentContainer = containers.find(c => c.id === container.parentContainerId);
              const allChildren = getAllChildrenOfContainer(container.id);
              const hasChildren = allChildren.services.length > 0 || allChildren.containers.length > 0;
              
              return (
                <div
                  key={container.id}
                  className="absolute group container-wrapper"
                  style={{
                    left: container.x,
                    top: container.y,
                    width: container.width,
                    height: container.height,
                    zIndex: draggedItem?.id === container.id ? 1000 : 10 + depth * 5
                  }}
                >
                  <div 
                    className="w-full h-full rounded-xl bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 transition-all shadow-sm border relative"
                    style={{ 
                      borderColor: container.color,
                      borderStyle: container.borderStyle === 'dashed' ? 'dashed' : container.borderStyle === 'dotted' ? 'dotted' : 'solid',
                      borderWidth: '2px',
                      // ネストされたコンテナには異なる背景色を適用
                      backgroundColor: parentContainer 
                        ? `${container.color}04` 
                        : 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {/* ドラッグ可能なヘッダー部分 */}
                    <div 
                      draggable={!hasChildren}
                      onDragStart={(e) => handleExistingContainerDragStart(e, container)}
                      className={`px-3 py-1.5 font-semibold rounded-tl-xl rounded-br-xl inline-block shadow-sm relative ${
                        !hasChildren
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-not-allowed opacity-75'
                      }`}
                      style={{ 
                        backgroundColor: container.color,
                        color: 'white',
                        zIndex: 1,
                        fontSize: Math.round(12 * (zoomLevel / 100)) + 'px'
                      }}
                      title={
                        !hasChildren
                          ? 'Drag to move container'
                          : 'Cannot move container with items inside'
                      }
                    >
                      <Move size={10} className="inline mr-1.5" />
                      {container.name}
                      {hasChildren && (
                        <span 
                          className="ml-2 opacity-75"
                          style={{ fontSize: Math.round(10 * (zoomLevel / 100)) + 'px' }}
                        >
                          ({allChildren.services.length + allChildren.containers.length})
                        </span>
                      )}
                      {/* ネストレベル表示 */}
                      {depth > 0 && (
                        <span 
                          className="ml-1 opacity-60"
                          style={{ fontSize: Math.round(10 * (zoomLevel / 100)) + 'px' }}
                        >
                          L{depth}
                        </span>
                      )}
                    </div>
                    
                    {/* 親コンテナ情報表示 */}
                    {parentContainer && (
                      <div 
                        className="absolute top-0 right-0 px-2 py-1 rounded-bl-lg"
                        style={{ 
                          backgroundColor: parentContainer.color,
                          color: 'white',
                          opacity: 0.7,
                          fontSize: Math.round(10 * (zoomLevel / 100)) + 'px'
                        }}
                      >
                        in {parentContainer.name}
                      </div>
                    )}
                    
                    {/* リサイズハンドル */}
                    {/* 右端リサイズハンドル */}
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ marginRight: '-4px' }}
                      onMouseDown={(e) => handleResizeStart(e, container.id, 'width')}
                    >
                      <div className="w-full h-full bg-blue-500 bg-opacity-50 rounded-r-lg"></div>
                    </div>
                    
                    {/* 下端リサイズハンドル */}
                    <div
                      className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ marginBottom: '-4px' }}
                      onMouseDown={(e) => handleResizeStart(e, container.id, 'height')}
                    >
                      <div className="w-full h-full bg-blue-500 bg-opacity-50 rounded-b-lg"></div>
                    </div>
                    
                    {/* 右下角リサイズハンドル */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ marginBottom: '-4px', marginRight: '-4px' }}
                      onMouseDown={(e) => handleResizeStart(e, container.id, 'both')}
                    >
                      <div className="w-full h-full bg-blue-600 bg-opacity-70 rounded-br-lg"></div>
                    </div>
                    
                    <button
                      onClick={() => removeContainer(container.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            });
          })()}

          {/* 配置されたサービス */}
          {boardItems.map(item => {
            const parentContainer = containers.find(c => c.id === item.parentContainerId);
            const isConnectionHighlighted = connectionStart && connectionStart.id === item.id;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, item)}
                onClick={(e) => handleServiceClick(e, item)}
                onDoubleClick={(e) => handleServiceDoubleClick(e, item)}
                onContextMenu={(e) => handleServiceRightClick(e, item)}
                className={`absolute group ${
                  selectedTool === 'connection' || isDrawingConnection
                    ? 'cursor-pointer' 
                    : 'cursor-grab active:cursor-grabbing'
                }`}
                style={{
                  left: item.x,
                  top: item.y,
                  zIndex: draggedItem?.id === item.id ? 1000 : 100
                }}
              >
                <div className="relative">
                  {/* 接続点の表示 */}
                  {(selectedTool === 'connection' || isDrawingConnection) && (
                    <>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white shadow-sm"></div>
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white shadow-sm"></div>
                      <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 w-2 h-2 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white shadow-sm"></div>
                      <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-2 h-2 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white shadow-sm"></div>
                    </>
                  )}
                  
                  <div 
                    className={`rounded-xl flex items-center justify-center text-white font-semibold shadow-lg hover:shadow-xl transition-all border-2 ${
                      isConnectionHighlighted 
                        ? 'border-blue-400 animate-pulse scale-105' 
                        : parentContainer 
                          ? 'border-opacity-70' 
                          : 'border-white border-opacity-20 hover:border-opacity-40'
                    } ${
                      selectedTool === 'connection' || isDrawingConnection ? 'hover:scale-105' : ''
                    }`}
                    style={{ 
                      width: serviceSize,
                      height: serviceSize,
                      backgroundColor: item.color,
                      borderColor: isConnectionHighlighted 
                        ? '#60A5FA' 
                        : parentContainer ? parentContainer.color : undefined,
                      fontSize: Math.round(12 * (zoomLevel / 100)) + 'px'
                    }}
                  >
                    {(() => {
                      const customAbbreviations = {
                        // Infrastructure
                        'On-Premises': 'ON-P',
                        'Data Center': 'DC',
                        'Corporate Network': 'CORP',
                        
                        // Actors
                        'User': 'USR',
                        'Developer': 'DEV',
                        
                        // Networking (Expanded)
                        'Direct Connect': 'DX',
                        'Transit Gateway': 'TGW',
                        'VPC Peering': 'PCR',
                        'NAT Gateway': 'NAT',
                        'Internet Gateway': 'IGW',
                        'VPN Gateway': 'VGW',
                        'Customer Gateway': 'CGW',
                        
                        // DevOps
                        'CodeBuild': 'CB',
                        'CodePipeline': 'CP',
                        'CodeDeploy': 'CD',
                        'CodeConnection': 'CC',
                        'CodeCommit': 'CM',
                        'CodeArtifact': 'CA',
                        'GitHub': 'GIT',
                        'Repository': 'REPO',
                        'Branch': 'BR',
                        'Pull Request': 'PR',
                        'Commit': 'COM',
                        
                        // Integration
                        'Step Functions': 'SF',
                        'EventBridge': 'EB',
                        'AppSync': 'AS',
                        'API Gateway': 'AG',
                        
                        // Analytics
                        'Kinesis Firehose': 'KF',
                        'Kinesis Analytics': 'KA',
                        'OpenSearch': 'OS',
                        'QuickSight': 'QS',
                        
                        // ML/AI
                        'SageMaker': 'SM',
                        'Comprehend': 'COM',
                        'Rekognition': 'RK',
                        'Textract': 'TX',
                        'Translate': 'TR',
                        'Bedrock': 'BR',
                        
                        // IoT
                        'IoT Core': 'IC',
                        'IoT Device Management': 'IDM',
                        'IoT Analytics': 'IA',
                        'IoT Greengrass': 'IGG',
                        'IoT SiteWise': 'ISW',
                        
                        // Management
                        'CloudFormation': 'CF',
                        'CloudTrail': 'CT',
                        'CloudWatch': 'CW',
                        'Systems Manager': 'SSM',
                        'X-Ray': 'XR',
                        'Organizations': 'ORG',
                        
                        // Security
                        'ACM': 'ACM',
                        'Secrets Manager': 'SEC',
                        'GuardDuty': 'GD',
                        'Verified Access': 'VA',
                        
                        // Networking
                        'Route 53': 'R53',
                        'Direct Connect': 'DC',
                        
                        // Compute
                        'ECS Fargate': 'FG',
                        'ECR': 'ECR',
                        
                        // Database
                        'DocumentDB': 'DOC',
                        'ElastiCache': 'EC'
                      };
                      
                      // カスタム名がある場合はそれを使用
                      const displayName = item.customName || item.name;
                      
                      if (customAbbreviations[displayName]) {
                        return customAbbreviations[displayName];
                      }
                      
                      return displayName.length <= 3 ? displayName.toUpperCase() : 
                             displayName.includes(' ') ? 
                             displayName.split(' ').map(word => word[0]).join('').toUpperCase() :
                             displayName.substring(0, 2).toUpperCase();
                    })()}
                  </div>
                  <div className={`text-xs text-center mt-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    {editingLabel === item.id ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleLabelSubmit(item.id)}
                        onKeyDown={(e) => handleLabelKeyDown(e, item.id)}
                        className={`text-xs text-center border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-500 text-gray-100 focus:border-blue-400'
                            : 'bg-white border-blue-300 text-gray-900'
                        }`}
                        style={{ 
                          width: serviceSize + 'px',
                          fontSize: Math.round(11 * (zoomLevel / 100)) + 'px'
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div 
                        className={`font-medium rounded-lg px-1 py-0.5 transition-colors cursor-text ${
                          isDarkMode 
                            ? 'hover:bg-gray-800 hover:bg-opacity-60' 
                            : 'hover:bg-white hover:bg-opacity-80'
                        }`}
                        style={{ 
                          maxWidth: serviceSize + 'px',
                          fontSize: Math.round(11 * (zoomLevel / 100)) + 'px'
                        }}
                        title="Double-click to edit"
                      >
                        {item.customName || item.name}
                      </div>
                    )}
                    {parentContainer && (
                      <div className={`text-xs mt-0.5 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`} style={{ fontSize: Math.round(10 * (zoomLevel / 100)) + 'px' }}>
                        in {parentContainer.name}
                      </div>
                    )}
                  </div>
                  {(selectedTool === 'connection' || isDrawingConnection) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm"></div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 空の状態の説明 */}
          {boardItems.length === 0 && containers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Plus size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2 font-medium">Drag services and containers from the sidebar</p>
                <p className="text-sm mb-4">to start building your AWS and on-premises architecture</p>
                <div className={`mt-6 space-y-2 text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                  <p>Users & Services: Place actors and AWS services on the canvas</p>
                  <p>Cloud Containers: Create AWS Cloud, VPC, Subnet and security groups</p>
                  <p>On-Premises Containers: Create Data Center, Corporate Network, Server Rack</p>
                  <p>Connections: Draw lines between services</p>
                  <p>Git Workflow: Repository, Branch, Pull Request, Commit components</p>
                  <p>Infrastructure: On-premises, Data Center, Corporate Network</p>
                  <p>Networking: Direct Connect, Transit Gateway, VPC Peering, Gateways</p>
                  <p>Advanced: Enable {advancedMode ? 'to see' : 'for'} Analytics, ML/AI, IoT services</p>
                  <p>Basic services include ECR, ElastiCache, Route 53, CloudFormation, ACM</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* インポートモーダル */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 99999 }}>
            <div className={`rounded-2xl p-8 shadow-2xl border max-w-2xl w-full mx-4 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>Import Architecture</h2>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Paste JSON data or Eraser.io Mermaid code below
                </p>
              </div>
              
              <div className="mb-4">
                <textarea
                  value={importText}
                  onChange={(e) => handleImportTextChange(e.target.value)}
                  placeholder={`Paste your code here...

Examples:
• JSON: {"version": "1.0", "boardItems": [...]}
• Eraser.io: 
  direction right
  AWS [icon: aws-cloud] {
    VPC [icon: aws-vpc] {
      service [label: "Service", icon: aws-ec2]
    }
  }
  OnPremises [label: "Data Center", icon: data-center] {
    corporate [label: "Corporate Network", icon: corporate-network] {
      server [label: "Server", icon: on-premises-server]
    }
  }
  Repository [icon: git-repository] {
    main_branch [label: "main", icon: git-branch]
    feature_branch [label: "feature", icon: git-branch]
  }
  user [label: "User", icon: user]
  user > service
  server > service : "Direct Connect"
  main_branch > service`}
                  className={`w-full h-64 p-4 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              
              {/* 形式判定表示 */}
              <div className="mb-6 flex items-center gap-3">
                <span className={`text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Detected format:
                </span>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  detectedFormat === 'json' 
                    ? isDarkMode
                      ? 'bg-blue-900 bg-opacity-50 text-blue-300'
                      : 'bg-blue-100 text-blue-700'
                    : detectedFormat === 'eraser'
                      ? isDarkMode
                        ? 'bg-orange-900 bg-opacity-50 text-orange-300'
                        : 'bg-orange-100 text-orange-700'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-gray-100 text-gray-500'
                }`}>
                  {detectedFormat === 'json' ? 'JSON Data' :
                   detectedFormat === 'eraser' ? 'Eraser.io Mermaid' :
                   'Unknown Format'}
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportText('');
                    setDetectedFormat('unknown');
                  }}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={executeImport}
                  disabled={detectedFormat === 'unknown' || !importText.trim()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    detectedFormat !== 'unknown' && importText.trim()
                      ? isDarkMode
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Import Architecture
                </button>
              </div>
            </div>
          </div>
        )}

        {/* コピー完了モーダル */}
        {showCopyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 99999 }}>
            <div className={`rounded-2xl p-8 shadow-2xl border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>Export Complete</h2>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  {exportFormat === 'eraser' ? 'Eraser.io' : 'Flowchart'} Mermaid code copied to clipboard
                </p>
              </div>
            </div>
          </div>
        )}

        {/* インポート完了モーダル */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 99999 }}>
            <div className={`rounded-2xl p-8 shadow-2xl border max-w-md ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>Import Complete</h2>
                <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Architecture successfully imported
                </p>
                <div className={`text-sm rounded-lg p-3 ${
                  isDarkMode ? 'bg-blue-900 bg-opacity-30 text-blue-300' : 'bg-blue-50 text-blue-700'
                }`}>
                  <p>• Services: {boardItems.length}</p>
                  <p>• Containers: {containers.length}</p>
                  <p>• Connections: {connections.length}</p>
                </div>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className={`mt-4 px-6 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shareモーダル */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 99999 }}>
            <div className={`rounded-2xl p-8 shadow-2xl border max-w-2xl w-full mx-4 ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Share className="w-8 h-8 text-white" />
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>Share Architecture</h2>
                <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Share your architecture with others via URL
                </p>
                
                <div className={`text-sm rounded-lg p-3 mb-4 ${
                  isDarkMode ? 'bg-blue-900 bg-opacity-30 text-blue-300' : 'bg-blue-50 text-blue-700'
                }`}>
                  <p>✓ URL copied to clipboard automatically</p>
                  <p>✓ Includes all services, containers, and connections</p>
                  <p>✓ Preserves layout and settings</p>
                </div>

                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 text-left ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Share URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm font-mono ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-gray-200'
                          : 'bg-gray-50 border-gray-300 text-gray-800'
                      }`}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        copySuccess
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : isDarkMode
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {copySuccess ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowShareModal(false)}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AWSArchitectureBoard;