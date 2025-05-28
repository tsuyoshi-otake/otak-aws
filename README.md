# otak-aws

AWSアーキテクチャボード（React + Vite + Tailwind CSS）

## 概要

otak-awsは、AWSアーキテクチャ図を直感的に作成・編集・共有できるWebアプリケーションです。ドラッグ&ドロップ操作で簡単にAWSサービスを配置し、接続関係を視覚化できます。

### 主な特徴

- **ドラッグ&ドロップ操作** - AWSサービスやコンテナを簡単に配置
- **接続線の描画** - サービス間の関係を視覚的に表現
- **コンテナのネスト** - VPC、サブネット、セキュリティグループなどの階層構造を表現
- **ズーム機能** - 50%、75%、100%の3段階ズーム
- **ダークモード対応** - 目に優しい表示切り替え
- **エクスポート機能** - Eraser.io形式またはMermaid flowchart形式でエクスポート
- **インポート機能** - JSON形式またはEraser.io Mermaid形式からインポート
- **URL共有機能** - LZ-String圧縮によるコンパクトな共有URL生成
- **Undo機能** - Ctrl+Z（Cmd+Z）で操作を元に戻す
- **グリッドスナップ** - 整列された配置を実現

## 技術スタック

- **フロントエンド**: React 18.2
- **ビルドツール**: Vite 5.2
- **スタイリング**: Tailwind CSS 3.4
- **アイコン**: Lucide React
- **圧縮**: LZ-String
- **テスト**: Vitest 3.1
- **言語**: TypeScript 5.4

## 開発

### 必要な環境

- Node.js 18以上
- npm または yarn

### セットアップ

```sh
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

開発サーバーは http://localhost:5173 で起動します。

### その他のコマンド

```sh
# プロダクションビルド
npm run build

# ビルドのプレビュー
npm run preview

# テストの実行
npm run test

# テストUI付きでテスト実行
npm run test:ui

# カバレッジレポート付きでテスト実行
npm run test:coverage
```

## 使い方

### 基本操作

1. **サービスの配置**
   - 左サイドバーから「Services」を選択
   - 配置したいAWSサービスをドラッグしてキャンバスにドロップ

2. **コンテナの配置**
   - 左サイドバーから「Containers」を選択
   - VPC、サブネットなどのコンテナをドラッグして配置
   - コンテナは入れ子にすることが可能

3. **接続線の描画**
   - 「Connections」ツールを選択
   - 接続元のサービスをクリック → 接続先のサービスをクリック
   - または、Shiftキーを押しながらサービスをクリック

4. **ラベルの編集**
   - サービスまたは接続線をダブルクリックして編集

### Advanced Mode

より多くのAWSサービスを利用したい場合は、「Advanced Mode」をONにしてください。以下のカテゴリのサービスが追加されます：

- Analytics（Kinesis、Athena、QuickSightなど）
- ML/AI（SageMaker、Bedrock、Rekognitionなど）
- IoT（IoT Core、IoT Greengrassなど）
- その他の高度なサービス

### エクスポート/インポート

#### エクスポート
- **Eraser.io形式**: Eraser.ioで編集可能なMermaid形式
- **Flowchart形式**: 標準的なMermaid flowchart形式

#### インポート
- JSON形式（アプリケーション独自形式）
- Eraser.io Mermaid形式

### URL共有

「Share」ボタンをクリックすると、現在のアーキテクチャ図を含むURLが生成されます。このURLを共有することで、他の人と図面を共有できます。

**注意**: 大規模なアーキテクチャ図の場合、URL長の制限（約2,000文字）により共有できない場合があります。

## アーキテクチャ

### コンポーネント構成

```
src/
├── App.tsx              # メインアプリケーションコンポーネント
├── main.tsx            # エントリーポイント
├── index.css           # グローバルスタイル
├── test-setup.ts       # Vitestセットアップ
└── utils/
    ├── compression.ts   # LZ-String圧縮ユーティリティ
    └── compression.test.ts  # 圧縮機能のテスト
```

### データ構造

#### ServiceItem
```typescript
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
```

#### ContainerItem
```typescript
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
```

#### Connection
```typescript
interface Connection {
  id: string;
  from: string;
  to: string;
  label?: string;
}
```

### 圧縮アルゴリズム

URL共有機能では、LZ-Stringライブラリを使用してデータを圧縮しています：

1. データの最適化（デフォルト値の除外）
2. JSON文字列化
3. LZ-String圧縮（`compressToEncodedURIComponent`）
4. URLパラメータとして付与

旧Base64形式との後方互換性も維持しています。

## デプロイ

### GitHub Pages

```sh
npm run deploy
```

このコマンドは内部で以下を実行します：
1. `npm run build` - プロダクションビルド
2. `gh-pages -d dist` - distフォルダをgh-pagesブランチにデプロイ

## 公開URL

https://tsuyoshi-otake.github.io/otak-aws/

## ライセンス

このプロジェクトはプライベートリポジトリです。

## 貢献

バグ報告や機能要望は、GitHubのIssuesでお願いします。

## 今後の予定

- [ ] より多くのAWSサービスアイコンの追加
- [ ] カスタムカラーテーマ
- [ ] 図面のテンプレート機能
- [ ] コラボレーション機能
- [ ] 画像エクスポート機能（PNG/SVG）
- [ ] キーボードショートカットの拡充