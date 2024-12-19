import { Button, Header, Input, Pagination, SpaceBetween, StatusIndicator, Table, TableProps } from '@cloudscape-design/components';
import { downloadData } from 'aws-amplify/storage';
import Papa from 'papaparse';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import tableStyles from './TableStyles.module.css';
import { getCSVFromS3 } from './utils/S3Utils';

interface DatasetVisualizerProps {
    dataset: {
        name: string;
        description?: string;
        owner: string;
        projectId: string;
        id: string;
    };
    s3Path?: string;
    previewData?: any[];
    columns?: TableProps.ColumnDefinition<any>[];
    version?: {
        uploadDate: string;
        size: number;
        rowCount: number;
        version?: number;
    };
    highlightedColumn?: string;
    className?: string;
    loading?: boolean;
    preview?: boolean;
    onDownloadFull?: () => void;
}

const DatasetVisualizer: React.FC<DatasetVisualizerProps> = ({
    dataset,
    s3Path,
    previewData: initialPreviewData,
    columns: initialColumns,
    version,
    highlightedColumn,
    className,
    loading: externalLoading,
    preview = true,
    onDownloadFull
}) => {
    const [data, setData] = useState<any[]>(initialPreviewData || []);
    const [columns, setColumns] = useState<TableProps.ColumnDefinition<any>[]>(initialColumns || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
    const PAGE_SIZE = 10;

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

    const loadFullData = useCallback(async () => {
        if (!s3Path || isFullDataLoaded) return;
        
        setLoading(true);
        try {
            if (s3Path.startsWith('s3://')) {
                const { data: csvData } = await getCSVFromS3(s3Path, { preview: false });
                setData(csvData);
            } else {
                const { body } = await downloadData({
                    path: s3Path
                }).result;
                
                const csvContent = await body.text();
                Papa.parse(csvContent, {
                    header: true,
                    complete: (results) => {
                        setData(results.data);
                    }
                });
            }
            
            if (version && !version.rowCount) {
                version.rowCount = data.length;
            }
            
            setIsFullDataLoaded(true);
        } catch (error) {
            console.error('Error loading full data:', error);
        } finally {
            setLoading(false);
        }
    }, [s3Path, isFullDataLoaded, version]);

    // Filter data based on search term
    const filteredData = useMemo(() => {
        const result = !searchTerm ? data : data.filter(row => 
            Object.values(row).some(value => 
                value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
        return result;
    }, [data, searchTerm]);

    // Get current page data
    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const result = filteredData.slice(startIndex, startIndex + PAGE_SIZE);
        return result;
    }, [filteredData, currentPage, PAGE_SIZE]);

    const totalPages = Math.ceil((filteredData?.length || 0) / PAGE_SIZE);

    // Add debug logging after all computations
    useEffect(() => {
        console.debug('DatasetVisualizer state:', {
            dataLength: data.length,
            columnsLength: columns.length,
            isFullDataLoaded,
            searchTerm,
            currentPage
        });
    }, [data, columns, isFullDataLoaded, searchTerm, currentPage]);

    // Load initial data
    useEffect(() => {
        // Skip if we already have data or no path
        if (!s3Path || initialPreviewData || loading) return;
        
        const loadInitialData = async () => {
            setLoading(true);
            try {
                console.debug('Loading data from:', s3Path);

                if (s3Path.startsWith('s3://')) {
                    // Use S3Utils for prediction results
                    const { data: csvData, meta } = await getCSVFromS3(s3Path, { 
                        preview: preview,
                        previewRows: preview ? 10 : undefined
                    });
                    
                    setData(csvData);
                    if (meta.fields && !initialColumns) {
                        setColumns(meta.fields.map(field => ({
                            id: field,
                            header: field,
                            cell: (item: any) => item[field]?.toString() || '-'
                        })));
                    }
                } else {
                    // Use Amplify Storage for datasets
                    console.debug('Downloading from Amplify Storage:', s3Path);
                    const { body } = await downloadData({
                        path: s3Path,
                        options: preview ? {
                            bytesRange: { start: 0, end: 102400 } // 100KB for preview
                        } : undefined
                    }).result;

                    const csvContent = await body.text();
                    
                    // Convert Papa.parse to Promise to ensure state updates happen
                    await new Promise<void>((resolve, reject) => {
                        Papa.parse(csvContent, {
                            header: true,
                            preview: preview ? 10 : undefined,
                            complete: (results) => {
                                console.debug('Papa parse complete:', {
                                    rowCount: results.data.length,
                                    fields: results.meta.fields,
                                    firstRow: results.data[0]
                                });
                                
                                setData(results.data);
                                if (results.meta.fields && !initialColumns) {
                                    setColumns(results.meta.fields.map(field => ({
                                        id: field,
                                        header: field,
                                        cell: (item: any) => item[field]?.toString() || '-'
                                    })));
                                }
                                resolve();
                            },
                            error: reject
                        });
                    });

                    setIsFullDataLoaded(!preview);
                }
            } catch (error) {
                console.error('Error loading initial data:', error);
                setData([]);
                setColumns([]);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [s3Path]); // Only depend on s3Path

    return (
        <Table
            className={`${tableStyles.previewTable} ${className || ''}`}
            columnDefinitions={highlightedColumns}
            items={currentData}
            loading={loading || externalLoading}
            loadingText="Loading data..."
            filter={
                <SpaceBetween direction="horizontal" size="xs">
                    <Input
                        type="search"
                        placeholder="Search in data..."
                        value={searchTerm}
                        onChange={({ detail }) => {
                            setSearchTerm(detail.value);
                            setCurrentPage(1);
                        }}
                    />
                    {preview && (
                        <SpaceBetween direction="horizontal" size="xs">
                            {!isFullDataLoaded && (
                                <Button
                                    onClick={loadFullData}
                                    loading={loading}
                                >
                                    Load Full Dataset
                                </Button>
                            )}
                            {onDownloadFull && (
                                <Button
                                    onClick={onDownloadFull}
                                    iconName="download"
                                >
                                    Download File
                                </Button>
                            )}
                        </SpaceBetween>
                    )}
                </SpaceBetween>
            }
            pagination={
                <Pagination
                    currentPageIndex={currentPage}
                    onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                    pagesCount={totalPages}
                    ariaLabels={{
                        nextPageLabel: 'Next page',
                        previousPageLabel: 'Previous page',
                        pageLabel: pageNumber => `Page ${pageNumber} of ${totalPages}`
                    }}
                />
            }
            header={
                <Header
                    variant="h2"
                    description={dataset.description}
                    counter={`(${version?.rowCount?.toString()} rows)`}
                >
                    <SpaceBetween direction="horizontal" size="xs">
                        <h3 style={{ margin: 0 }}>{dataset.name}</h3>
                        {preview && !isFullDataLoaded && (
                            <StatusIndicator type="info">Preview</StatusIndicator>
                        )}
                    </SpaceBetween>
                </Header>
            }
            wrapLines
            variant="embedded"
            stripedRows
        />
    );
};

export default DatasetVisualizer;