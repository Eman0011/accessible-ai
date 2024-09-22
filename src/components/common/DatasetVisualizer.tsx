import { Header, SpaceBetween, Table, TableProps } from '@cloudscape-design/components';
import React from 'react';
import { Dataset } from '../../types/models';

interface DatasetVisualizerProps {
  dataset: Dataset;
  previewData: any[];
  columns: TableProps.ColumnDefinition<any>[];
  limit?: number;
  highlightedColumn?: string | null;
}

const DatasetVisualizer: React.FC<DatasetVisualizerProps> = ({ 
  dataset, 
  previewData, 
  columns, 
  limit,
  highlightedColumn
}) => {
  // Function to apply highlighting style
  const getColumnStyle = (columnId: string) => {
    const baseStyle = { textAlign: 'center' as const };
    if (columnId === highlightedColumn) {
      return { 
        ...baseStyle, 
        backgroundColor: '#008000',  // Soft blue background
        color: 'white'  // Green text
      };
    }
    return baseStyle;
  };

  // Modify columns to include highlighting and centering
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
      <Header variant="h2">{dataset.name} (Version {dataset.version})</Header>
      <Table
        columnDefinitions={highlightedColumns}
        items={limit ? previewData.slice(0, limit) : previewData}
        header={<h3>Data Preview</h3>}
        wrapLines
      />
      <SpaceBetween size="s" direction="horizontal">
        <div>Rows: {dataset.rowCount}</div>
        <div>Size: {(dataset.size / 1024 / 1024).toFixed(2)} MB</div>
        <div>Upload Date: {new Date(dataset.uploadDate).toLocaleString()}</div>
      </SpaceBetween>
    </SpaceBetween>
  );
};

export default DatasetVisualizer;