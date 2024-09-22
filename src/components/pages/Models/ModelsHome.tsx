import {
    Box,
    Button,
    Header,
    Pagination,
    SpaceBetween,
    Table,
    TextFilter,
} from '@cloudscape-design/components';
import type { TableProps } from '@cloudscape-design/components'; // Add this import
import { generateClient } from 'aws-amplify/api';
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Schema } from '../../../../amplify/data/resource';
import { ProjectContext } from '../../../contexts/ProjectContext';
import { Model } from '../../../types/models';

const client = generateClient<Schema>();

const ModelsHome: React.FC = () => {
  const { currentProject } = useContext(ProjectContext);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [displayedModels, setDisplayedModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filteringText, setFilteringText] = useState('');
  const [sortingColumn, setSortingColumn] = useState<{ sortingField: keyof Model; sortingDescending: boolean } | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchModels();
  }, []);

  const filteredModels = useMemo(() => {
    let filtered = allModels;
    if (currentProject) {
      filtered = filtered.filter(model => model.projectId === currentProject.id);
    }
    if (filteringText) {
      const lowerCaseFilter = filteringText.toLowerCase();
      filtered = filtered.filter(model => 
        Object.values(model).some(value => 
          value && value.toString().toLowerCase().includes(lowerCaseFilter)
        )
      );
    }
    return filtered;
  }, [allModels, currentProject, filteringText]);

  useEffect(() => {
    let sortedModels = [...filteredModels];
    if (sortingColumn) {
      sortedModels.sort((a, b) => {
        const aValue = a[sortingColumn.sortingField];
        const bValue = b[sortingColumn.sortingField];
        if (aValue != null && bValue != null) {
          if (aValue < bValue) return sortingColumn.sortingDescending ? 1 : -1;
          if (aValue > bValue) return sortingColumn.sortingDescending ? -1 : 1;
        }
        return 0;
      });
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedModels(sortedModels.slice(startIndex, endIndex));
  }, [filteredModels, currentPage, sortingColumn]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await client.models.Model.list();
      if (response.data) {
        setAllModels(response.data.map(model => ({
          ...model,
          // Remove this line if status is not in the schema
          // status: model.status || 'DRAFT'
        })) as unknown as Model[]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const columnDefinitions = [
    {
      id: 'name',
      header: 'Name',
      cell: (item: Model) => <Link to={`/models/${item.id}`}>{item.name}</Link>,
      sortingField: 'name',
    },
    { id: 'description', header: 'Description', cell: (item: Model) => item.description, sortingField: 'description' },
    { 
      id: 'version', 
      header: 'Current Version', 
      cell: (item: Model) => item.version,
      sortingField: 'version',
    },
    { id: 'owner', header: 'Owner', cell: (item: Model) => item.owner, sortingField: 'owner' },
    { 
      id: 'createdAt', 
      header: 'Created At', 
      cell: (item: Model) => new Date(item.createdAt).toLocaleString(),
      sortingField: 'createdAt',
    },
    { 
      id: 'updatedAt', 
      header: 'Updated At', 
      cell: (item: Model) => new Date(item.updatedAt).toLocaleString(),
      sortingField: 'updatedAt',
    },
    { 
      id: 'status', 
      header: 'Status', 
      cell: (item: Model) => {
        switch(item.status) {
          case 'DRAFT':
            return <span style={{color: 'orange'}}>Draft</span>;
          case 'SUBMITTED':
            return <span style={{color: 'blue'}}>Submitted</span>;
          case 'TRAINING':
            return <span style={{color: 'teal'}}>Training</span>;
          case 'TRAINING_COMPLETED':
            return <span style={{color: 'green'}}>Training Completed</span>;
          case 'TRAINING_FAILED':
            return <span style={{color: 'red'}}>Training Failed</span>;
          case 'PUBLISHED':
            return <span style={{color: 'purple'}}>Published</span>;
          case 'ARCHIVED':
            return <span style={{color: 'gray'}}>Archived</span>;
          default:
            return item.status;
        }
      },
      sortingField: 'status',
    },
  ];

  const pagesCount = Math.ceil(filteredModels.length / itemsPerPage);

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Link to="/models/create">
              <Button variant="primary">Create New Model</Button>
            </Link>
          }
        >
          Models {currentProject ? `for ${currentProject.name}` : ''}
        </Header>
        <Table
          loading={loading}
          loadingText="Loading models..."
          items={displayedModels}
          columnDefinitions={columnDefinitions}
          header={
            <Header
              variant="h2"
              counter={`(${filteredModels.length})`}
              actions={
                <TextFilter
                  filteringText={filteringText}
                  filteringPlaceholder="Find models"
                  filteringAriaLabel="Filter models"
                  onChange={({ detail }) => {
                    setFilteringText(detail.filteringText);
                    setCurrentPage(1); // Reset to first page when filtering
                  }}
                />
              }
            >
              Your Models
            </Header>
          }
          sortingColumn={sortingColumn as TableProps.SortingColumn<Model> | undefined}
          sortingDescending={sortingColumn?.sortingDescending}
          onSortingChange={({ detail }) => {
            setSortingColumn(detail.sortingColumn as { sortingField: keyof Model; sortingDescending: boolean } | null);
          }}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No models</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                You don't have any models yet.
              </Box>
            </Box>
          }
        />
        {pagesCount > 1 && (
          <Pagination
            currentPageIndex={currentPage}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
            pagesCount={pagesCount}
          />
        )}
      </SpaceBetween>
    </Box>
  );
};

export default ModelsHome;
