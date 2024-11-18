import { Header, SpaceBetween, Table, TableProps } from '@cloudscape-design/components';
import React from 'react';
import { Dataset } from '../../types/models';
import tableStyles from './TableStyles.module.css';

interface DatasetVisualizerProps {
  dataset: Dataset;
  previewData: any[];
  columns: TableProps.ColumnDefinition<any>[];
  version?: {
    uploadDate: string;
    size: number;
    rowCount: number;
    version: number;
  };
  highlightedColumn?: string | null;
  className?: string;
}

const DatasetVisualizer: React.FC<DatasetVisualizerProps> = ({ 
  dataset, 
  previewData, 
  columns,
  version,
  highlightedColumn,
  className
}) => {
  const getColumnStyle = (columnId: string) => {
    const baseStyle = { textAlign: 'center' as const };
    if (columnId === highlightedColumn) {
      return { 
        ...baseStyle, 
        backgroundColor: '#008000',  // Green background
        color: 'white'  // White text
      };
    }
    return baseStyle;
  };

  const highlightedColumns = columns.map(col => ({
    ...col,
    cell: (item: any) => (
      <div style={getColumnStyle(col.id as string)}>
        {item[col.id as string]}
      </div>
    ),
    header: (
      <div style={getColumnStyle(col.id as string)}>
        {col.header}
      </div>
    )
  }));

  return (
    <SpaceBetween size="m">
      <Header variant="h2">
        {dataset.name} 
        {version && ` (v${version.version})`}
      </Header>
      <Table
        className={tableStyles.previewTable}
        columnDefinitions={highlightedColumns}
        items={previewData}
        header={<h3>Data Preview</h3>}
        wrapLines
        variant="embedded"
        stripedRows
      />
      {version && (
        <SpaceBetween size="s" direction="horizontal">
          <div>Rows: {version.rowCount.toLocaleString()}</div>
          <div>Size: {(version.size / (1024 * 1024)).toFixed(2)} MB</div>
          <div>Upload Date: {new Date(version.uploadDate).toLocaleString()}</div>
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default DatasetVisualizer;