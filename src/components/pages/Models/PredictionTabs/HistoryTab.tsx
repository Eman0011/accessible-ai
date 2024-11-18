import { 
    Container, 
    Table, 
    Pagination, 
    SegmentedControl, 
    Box, 
    Button, 
    SpaceBetween,
    StatusIndicator,
    Link,
    Header
} from '@cloudscape-design/components';
import React, { useState, useEffect } from 'react';
import { Prediction } from '../../../../types/models';
import { PredictionTableColumns } from '../TableColumns';

interface HistoryTabProps {
    predictions: Prediction[];
    loading: boolean;
    predictionTypeFilter: 'all' | 'ADHOC' | 'BATCH';
    setPredictionTypeFilter: (filter: 'all' | 'ADHOC' | 'BATCH') => void;
    paginationProps: {
        currentPageIndex: number;
        onChange: ({ detail }: { detail: { currentPageIndex: number } }) => void;
        pagesCount: number;
    };
    onRefresh: () => void;
    onCopyPrediction: (prediction: Prediction) => void;
    selectedPrediction?: Prediction;
    onSelectionChange: (prediction: Prediction | undefined) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    predictions,
    loading,
    predictionTypeFilter,
    setPredictionTypeFilter,
    paginationProps,
    onRefresh,
    onCopyPrediction,
    selectedPrediction,
    onSelectionChange
}) => {
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const calculatePageSize = () => {
            const ROW_HEIGHT = 50;
            const BUFFER_HEIGHT = 250;
            
            const availableHeight = window.innerHeight - BUFFER_HEIGHT;
            const calculatedRows = Math.floor(availableHeight / ROW_HEIGHT);
            
            const rows = Math.max(5, Math.min(calculatedRows, 20));
            setPageSize(rows);
        };

        calculatePageSize();
        window.addEventListener('resize', calculatePageSize);
        
        return () => window.removeEventListener('resize', calculatePageSize);
    }, []);

    const filteredPredictions = predictions.filter(prediction => 
        predictionTypeFilter === 'all' || prediction.type === predictionTypeFilter
    );

    const startIndex = (paginationProps.currentPageIndex - 1) * pageSize;
    const paginatedItems = filteredPredictions.slice(startIndex, startIndex + pageSize);

    return (
        <Table
            loading={loading}
            columnDefinitions={[
                {
                    id: 'timestamp',
                    header: 'Timestamp',
                    cell: item => new Date(item.createdAt || '').toLocaleString(),
                    sortingField: 'createdAt'
                },
                {
                    id: 'latency',
                    header: 'Latency',
                    cell: item => item.inferenceLatency ? `${item.inferenceLatency}ms` : '-'
                },
                {
                    id: 'type',
                    header: 'Type',
                    cell: item => item.type
                },
                {
                    id: 'status',
                    header: 'Status',
                    cell: item => (
                        <StatusIndicator type={
                            item.status === 'COMPLETED' ? 'success' :
                            item.status === 'FAILED' ? 'error' :
                            item.status === 'RUNNING' ? 'in-progress' :
                            'pending'
                        }>
                            {item.status}
                        </StatusIndicator>
                    )
                },
                {
                    id: 'result',
                    header: 'Result',
                    cell: item => {
                        if (item.status !== 'COMPLETED') return '-';
                        
                        if (item.type === 'ADHOC') {
                            try {
                                const output = JSON.parse(item.adhocOutput || '{}');
                                if (output.statusCode === 500) {
                                    return <StatusIndicator type="error">Failed</StatusIndicator>;
                                }
                                return Array.isArray(output.body) ? output.body[0] : output.body;
                            } catch (e) {
                                return 'Error parsing result';
                            }
                        }
                        return (
                            <Link href={item.outputDataPath}>
                                Download CSV
                            </Link>
                        );
                    }
                },
                {
                    id: 'input',
                    header: 'Input',
                    cell: item => {
                        if (item.type === 'ADHOC') {
                            try {
                                const input = JSON.parse(item.adhocInput || '{}');
                                return <Box>{Object.entries(input)
                                    .map(([key, value]) => `${key}: ${value}`)
                                    .join(', ')}
                                </Box>;
                            } catch (e) {
                                return 'Error parsing input';
                            }
                        }
                        return item.inputDataPath?.split('/').pop() || '-';
                    }
                }
            ]}
            items={paginatedItems}
            pagination={
                <Pagination 
                    currentPageIndex={paginationProps.currentPageIndex}
                    onChange={paginationProps.onChange}
                    pagesCount={Math.ceil(filteredPredictions.length / pageSize)}
                    pageSize={pageSize}
                />
            }
            header={
                <Header
                    counter={`(${predictions.length})`}
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button 
                                onClick={() => selectedPrediction && onCopyPrediction(selectedPrediction)}
                                disabled={!selectedPrediction}
                                iconName="copy"
                            >
                                Copy Prediction
                            </Button>
                            <Button
                                iconName="refresh"
                                loading={loading}
                                onClick={onRefresh}
                            />
                        </SpaceBetween>
                    }
                >
                    Predictions
                </Header>
            }
            filter={
                <SegmentedControl
                    selectedId={predictionTypeFilter}
                    onChange={({ detail }) => 
                        setPredictionTypeFilter(detail.selectedId as typeof predictionTypeFilter)
                    }
                    label="Filter by type"
                    options={[
                        { id: 'all', text: 'All' },
                        { id: 'ADHOC', text: 'Ad-hoc' },
                        { id: 'BATCH', text: 'Batch' }
                    ]}
                />
            }
            selectionType="single"
            selectedItems={selectedPrediction ? [selectedPrediction] : []}
            onSelectionChange={({ detail }) => 
                onSelectionChange(detail.selectedItems[0] as Prediction | undefined)
            }
            trackBy="id"
            variant="container"
            enableKeyboardNavigation={true}
            onRowClick={({ detail }) => 
                onSelectionChange(
                    selectedPrediction?.id === detail.item.id ? undefined : detail.item
                )
            }
            empty={
                <Box textAlign="center" color="inherit">
                    <b>No predictions</b>
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                        No predictions have been made yet.
                    </Box>
                </Box>
            }
        />
    );
}; 