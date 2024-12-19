import {
  Box,
  Button,
  Container,
  FormField,
  Header,
  Link,
  Select,
  SpaceBetween,
  Spinner,
  Tabs
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dataset, DatasetVersion } from '../../../types/models';
import DatasetVisualizer from '../../common/DatasetVisualizer';
import tableStyles from '../../common/TableStyles.module.css';
import styles from './DatasetDetails.module.css';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

const DatasetDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [dataset, setDataset] = useState<Dataset | null>(null);
    const [versions, setVersions] = useState<DatasetVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('details');

    const fetchDatasetDetails = async () => {
        if (!id) return;
        
        try {
            setLoading(true);
            const { data: fetchedDataset } = await client.models.Dataset.get({ id });
            const { data: fetchedVersions } = await client.models.DatasetVersion.list({
                filter: { datasetId: { eq: id } }
            });

            const sortedVersions: DatasetVersion[] = (fetchedVersions || []).map((v) => ({
                id: v.id || '',
                datasetId: v.datasetId || '',
                version: v.version || 1,
                s3Key: v.s3Key || '',
                size: v.size || 0,
                rowCount: v.rowCount || 0,
                uploadDate: v.uploadDate || new Date().toISOString(),
                createdAt: v.createdAt || null,
                updatedAt: v.updatedAt || null
            })).sort((a, b) => b.version - a.version);

            const dataset: Dataset = {
                id: fetchedDataset?.id || '',
                name: fetchedDataset?.name || '',
                description: fetchedDataset?.description || '',
                owner: fetchedDataset?.owner || '',
                projectId: fetchedDataset?.projectId || '',
                createdAt: fetchedDataset?.createdAt || null,
                updatedAt: fetchedDataset?.updatedAt || null
            };

            setDataset(dataset);
            setVersions(sortedVersions);
            
            // Select the latest version by default
            if (sortedVersions.length > 0) {
                setSelectedVersion(sortedVersions[0].id);
            }
        } catch (error) {
            console.error('Error fetching dataset details:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatasetDetails();
    }, [id]);

    if (loading) {
        return <Spinner size="large" />;
    }

    if (!dataset) {
        return <Box>Dataset not found</Box>;
    }

    const currentVersion = versions.find(v => v.id === selectedVersion);

    return (
        <SpaceBetween size="l">
            {/* Header Section */}
            <div className={styles.headerSection}>
                <SpaceBetween size="m">
                    <Header
                        variant="h1"
                        info={<Link external={false}>Info</Link>}
                        description={
                            <SpaceBetween size="s">
                                <Box variant="p">{dataset.description}</Box>
                                <Box variant="small" color="text-body-secondary">
                                    Created by {dataset.owner} on {new Date(dataset.createdAt || '').toLocaleDateString()}
                                </Box>
                            </SpaceBetween>
                        }
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button>Share</Button>
                                <Button variant="primary">Update Dataset</Button>
                            </SpaceBetween>
                        }
                    >
                        {dataset.name}
                    </Header>
                </SpaceBetween>
            </div>

            {/* Version Selection Container */}
            <Container>
                <div className={styles.versionSelectorLayout}>
                    <div className={styles.versionSelector}>
                        <FormField label="Dataset Version">
                            <Select
                                selectedOption={selectedVersion ? {
                                    label: `Version ${versions.find(v => v.id === selectedVersion)?.version}`,
                                    value: selectedVersion
                                } : null}
                                onChange={({ detail }) => setSelectedVersion(detail.selectedOption.value || null)}
                                options={versions.map(version => ({
                                    label: `Version ${version.version}`,
                                    value: version.id,
                                    description: new Date(version.uploadDate).toLocaleDateString()
                                }))}
                            />
                        </FormField>
                    </div>

                    <div className={styles.versionDetailsColumn}>
                        {currentVersion && (
                            <div className={styles.versionDetails}>
                                <SpaceBetween size="m" direction="horizontal">
                                    <Box variant="awsui-key-label">
                                        Upload Date
                                        <Box variant="p">
                                            {new Date(currentVersion.uploadDate).toLocaleString()}
                                        </Box>
                                    </Box>
                                    <Box variant="awsui-key-label">
                                        Size
                                        <Box variant="p">
                                            {(currentVersion.size / 1024 / 1024).toFixed(2)} MB
                                        </Box>
                                    </Box>
                                    <Box variant="awsui-key-label">
                                        Rows
                                        <Box variant="p">
                                            {currentVersion.rowCount.toLocaleString()}
                                        </Box>
                                    </Box>
                                </SpaceBetween>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs Section */}
                <Tabs
                    activeTabId={activeTab}
                    onChange={({ detail }) => setActiveTab(detail.activeTabId)}
                    tabs={[
                        {
                            id: 'details',
                            label: 'Details',
                            content: (
                                <SpaceBetween size="l">
                                    <DatasetVisualizer
                                        dataset={dataset}
                                        s3Path={currentVersion?.s3Key}
                                        version={{
                                            uploadDate: currentVersion?.uploadDate || '',
                                            size: currentVersion?.size || 0,
                                            rowCount: currentVersion?.rowCount || 0,
                                            version: currentVersion?.version
                                        }}
                                        className={tableStyles.previewTable}
                                    />
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'analysis',
                            label: 'Exploratory Analysis',
                            content: (
                                <Box>Exploratory Analysis content coming soon...</Box>
                            )
                        }
                    ]}
                />
            </Container>
        </SpaceBetween>
    );
};

export default DatasetDetails; 