// server.js - Node.js Bridge Server for Graph Visualization App
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const app = express();
const port = process.env.PORT || 3000;
const execAsync = promisify(exec);

// Middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files from root

// Path configurations
const dataDir = path.join(__dirname, 'data');
const savedGraphsDir = path.join(dataDir, 'saved_graphs');
const backendBuildDir = path.join(__dirname, 'backend', 'build');

// Input/Output file paths
const graphInputPath = path.join(dataDir, 'graph_input.json');
const routeInputPath = path.join(dataDir, 'route_input.json');
const graphOutputPath = path.join(dataDir, 'graph.json');
const routeOutputPath = path.join(dataDir, 'route.json');

// Ensure required directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(savedGraphsDir, { recursive: true });
        await fs.mkdir(backendBuildDir, { recursive: true });
        console.log('Directories initialized');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Ensure data files exist with default content
async function ensureDataFiles() {
    const files = [
        { path: graphInputPath, default: { nodeCount: 10, method: 'random' } },
        { path: routeInputPath, default: { source: 1, destination: 92, battery: 100, mileage: 10 } },
        { path: graphOutputPath, default: { nodes: [], edges: [], name: 'Default Graph' } },
        { path: routeOutputPath, default: { success: false, message: 'No path computed' } }
    ];

    for (const file of files) {
        try {
            await fs.access(file.path);
        } catch {
            // File doesn't exist, create it with default content
            await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
            console.log(`Created default file: ${file.path}`);
        }
    }
}

// API Routes

// Generate graph endpoint
app.post('/generateGraph', async (req, res) => {
    try {
        const { nodeCount, method } = req.body;

        // Validate input
        if (!nodeCount || nodeCount < 2 || nodeCount > 500) {
            return res.status(400).json({
                success: false,
                message: 'Node count must be between 2 and 500'
            });
        }

        if (!method || !['random', 'sliding_window'].includes(method)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid graph generation method'
            });
        }

        // Write input to JSON file
        const inputData = {
            nodeCount: parseInt(nodeCount),
            method: method
        };

        await fs.writeFile(graphInputPath, JSON.stringify(inputData, null, 2));
        console.log('Graph input written to:', graphInputPath);

        // Execute graph generator from the data directory
        const generatorPath = path.join(backendBuildDir, 'generator');
        
        try {
            await execAsync(`cd "${dataDir}" && "${generatorPath}"`);
            console.log('Graph generator executed successfully');
        } catch (execError) {
            console.error('Graph generator execution failed:', execError);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate graph: ' + execError.message
            });
        }

        // Read generated graph
        const graphData = await readJsonFile(graphOutputPath);
        
        if (!graphData) {
            return res.status(500).json({
                success: false,
                message: 'Failed to read generated graph'
            });
        }

        res.json({
            success: true,
            graph: graphData,
            message: `Graph generated with ${nodeCount} nodes using ${method} method`
        });

    } catch (error) {
        console.error('Error in /generateGraph:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Find path endpoint
app.post('/findPath', async (req, res) => {
    try {
        const { source, destination, battery, mileage } = req.body;

        // Validate input
        if (source === undefined || destination === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Source and destination nodes are required'
            });
        }

        if (!battery || battery <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Battery must be a positive number'
            });
        }

        if (!mileage || mileage <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mileage must be a positive number'
            });
        }

        // Check if graph exists
        try {
            await fs.access(graphOutputPath);
        } catch {
            return res.status(400).json({
                success: false,
                message: 'No graph available. Please generate a graph first.'
            });
        }

        // Write input to JSON file
        const inputData = {
            source: parseInt(source),
            destination: parseInt(destination),
            battery: parseInt(battery),
            mileage: parseInt(mileage)
        };

        await fs.writeFile(routeInputPath, JSON.stringify(inputData, null, 2));
        console.log('Route input written to:', routeInputPath);

        // Execute Dijkstra's algorithm from the data directory
        const dijkstraPath = path.join(backendBuildDir, 'dijkstra');
        
        try {
            await execAsync(`cd "${dataDir}" && "${dijkstraPath}"`);
            console.log('Dijkstra executed successfully');
        } catch (execError) {
            console.error('Dijkstra execution failed:', execError);
            return res.status(500).json({
                success: false,
                message: 'Failed to find path: ' + execError.message
            });
        }

        // Read path result
        const pathResult = await readJsonFile(routeOutputPath);
        
        if (!pathResult) {
            return res.status(500).json({
                success: false,
                message: 'Failed to read path result'
            });
        }

        res.json(pathResult);

    } catch (error) {
        console.error('Error in /findPath:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Save graph endpoint
app.post('/saveGraph', async (req, res) => {
    try {
        const { graphName, graph } = req.body;

        // Validate input
        if (!graphName || graphName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Graph name is required'
            });
        }

        if (!graph) {
            return res.status(400).json({
                success: false,
                message: 'Graph data is required'
            });
        }

        // Sanitize filename
        const sanitizedName = graphName.replace(/[^a-zA-Z0-9_\-\s]/g, '_');
        const filename = `${sanitizedName}.json`;
        const filePath = path.join(savedGraphsDir, filename);

        // Check if file already exists
        try {
            await fs.access(filePath);
            return res.status(400).json({
                success: false,
                message: 'A graph with this name already exists'
            });
        } catch {
            // File doesn't exist, which is good
        }

        // Add timestamp to graph data
        const graphToSave = {
            ...graph,
            savedAt: new Date().toISOString(),
            savedName: graphName
        };

        // Save graph
        await fs.writeFile(filePath, JSON.stringify(graphToSave, null, 2));
        console.log('Graph saved to:', filePath);

        res.json({
            success: true,
            message: `Graph "${graphName}" saved successfully`,
            filename: filename
        });

    } catch (error) {
        console.error('Error in /saveGraph:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Load graph endpoint
app.post('/loadGraph', async (req, res) => {
    try {
        const { graphName } = req.body;

        if (!graphName) {
            return res.status(400).json({
                success: false,
                message: 'Graph name is required'
            });
        }

        const filePath = path.join(savedGraphsDir, graphName);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Graph not found'
            });
        }

        // Read graph data
        const graphData = await readJsonFile(filePath);
        
        if (!graphData) {
            return res.status(500).json({
                success: false,
                message: 'Failed to read graph data'
            });
        }

        // Also update the current graph.json
        await fs.writeFile(graphOutputPath, JSON.stringify(graphData, null, 2));

        res.json({
            success: true,
            graph: graphData,
            message: `Graph "${graphName.replace('.json', '')}" loaded successfully`
        });

    } catch (error) {
        console.error('Error in /loadGraph:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// List saved graphs endpoint
app.get('/listGraphs', async (req, res) => {
    try {
        let files;
        try {
            files = await fs.readdir(savedGraphsDir);
        } catch {
            files = [];
        }

        // Filter JSON files and sort by modification time (newest first)
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const graphs = await Promise.all(
            jsonFiles.map(async (file) => {
                try {
                    const filePath = path.join(savedGraphsDir, file);
                    const stats = await fs.stat(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime
                    };
                } catch {
                    return null;
                }
            })
        );

        // Filter out null results and sort by modification time
        const validGraphs = graphs.filter(graph => graph !== null)
            .sort((a, b) => b.modified - a.modified)
            .map(graph => graph.name);

        res.json({
            success: true,
            graphs: validGraphs,
            count: validGraphs.length
        });

    } catch (error) {
        console.error('Error in /listGraphs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        endpoints: [
            '/generateGraph',
            '/findPath',
            '/saveGraph',
            '/loadGraph',
            '/listGraphs'
        ]
    });
});

// Utility function to read JSON files
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading JSON file ${filePath}:`, error);
        return null;
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Initialize and start server
async function startServer() {
    await ensureDirectories();
    await ensureDataFiles(); // Add this line to create default JSON files
    
    // Check if backend executables exist
    try {
        const generatorExists = await fs.access(path.join(backendBuildDir, 'generator.exe'))
            .then(() => true)
            .catch(() => false);
        
        const dijkstraExists = await fs.access(path.join(backendBuildDir, 'dijkstra.exe'))
            .then(() => true)
            .catch(() => false);

        if (!generatorExists || !dijkstraExists) {
            console.warn('Warning: Backend executables not found in build directory.');
            console.warn('Please compile the C++ code and place executables in backend/build/');
        }
    } catch (error) {
        console.warn('Warning: Could not check backend executables:', error.message);
    }

    app.listen(port, () => {
        console.log('=================================');
        console.log('Graph Visualization Server');
        console.log('=================================');
        console.log(`Server running on http://localhost:${port}`);
        console.log(`Data directory: ${dataDir}`);
        console.log(`Saved graphs: ${savedGraphsDir}`);
        console.log(`Backend build: ${backendBuildDir}`);
        console.log('=================================');
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down server gracefully...');
    process.exit(0);
});

// Start the server
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});