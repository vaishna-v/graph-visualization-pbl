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

// Comprehensive startup checks
async function startupChecks() {
    console.log('=== Railway Startup Checks ===');
    console.log('Current directory:', __dirname);
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    
    try {
        // Check backend build directory
        const buildFiles = await fs.readdir(backendBuildDir);
        console.log('Backend build files:', buildFiles);
        
        // Check if executables have execute permissions
        const generatorPath = path.join(backendBuildDir, 'generator');
        const dijkstraPath = path.join(backendBuildDir, 'dijkstra');
        
        try {
            await fs.access(generatorPath);
            console.log('✓ Generator executable exists');
            
            // Check permissions
            const stats = await fs.stat(generatorPath);
            console.log('Generator permissions:', stats.mode.toString(8));
        } catch (error) {
            console.error('✗ Generator executable not found:', generatorPath);
        }
        
        try {
            await fs.access(dijkstraPath);
            console.log('✓ Dijkstra executable exists');
            
            // Check permissions
            const stats = await fs.stat(dijkstraPath);
            console.log('Dijkstra permissions:', stats.mode.toString(8));
        } catch (error) {
            console.error('✗ Dijkstra executable not found:', dijkstraPath);
        }
    } catch (error) {
        console.error('Backend build directory error:', error);
    }
}

// Ensure required directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(savedGraphsDir, { recursive: true });
        await fs.mkdir(backendBuildDir, { recursive: true });
        console.log('✓ Directories initialized');
    } catch (error) {
        console.error('✗ Error creating directories:', error);
    }
}

// Ensure data files exist with default content
async function ensureDataFiles() {
    const files = [
        { path: graphInputPath, default: { nodeCount: 10, method: 'random' } },
        { path: routeInputPath, default: { source: 1, destination: 2, battery: 100, mileage: 10 } },
        { path: graphOutputPath, default: { nodes: [], edges: [], name: 'Default Graph' } },
        { path: routeOutputPath, default: { success: false, message: 'No path computed' } }
    ];

    for (const file of files) {
        try {
            await fs.access(file.path);
            console.log(`✓ File exists: ${file.path}`);
        } catch {
            // File doesn't exist, create it with default content
            await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
            console.log(`✓ Created default file: ${file.path}`);
        }
    }
}

// API Routes

// Generate graph endpoint
app.post('/generateGraph', async (req, res) => {
    try {
        console.log('=== Generate Graph Request ===');
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
        console.log('✓ Graph input written to:', graphInputPath);

        // Execute graph generator
        const generatorPath = path.join(backendBuildDir, 'generator');
        
        console.log('Generator path:', generatorPath);
        console.log('Data directory:', dataDir);
        
        // Check if generator exists and is executable
        try {
            await fs.access(generatorPath);
            console.log('✓ Generator executable found');
            
            // Check if it's executable
            const stats = await fs.stat(generatorPath);
            const isExecutable = !!(stats.mode & 0o111);
            console.log('Generator is executable:', isExecutable);
            
            if (!isExecutable) {
                console.log('⚠ Generator not executable, fixing permissions...');
                await fs.chmod(generatorPath, 0o755);
            }
        } catch (error) {
            console.error('✗ Generator executable not found or inaccessible:', error);
            return res.status(500).json({
                success: false,
                message: 'Generator executable not found on server'
            });
        }

        try {
            console.log('🚀 Executing generator...');
            const { stdout, stderr } = await execAsync(`cd "${dataDir}" && "${generatorPath}"`);
            console.log('✓ Graph generator executed successfully');
            if (stdout) console.log('Generator stdout:', stdout);
            if (stderr) console.log('Generator stderr:', stderr);
        } catch (execError) {
            console.error('✗ Graph generator execution failed:', execError);
            console.error('Error stdout:', execError.stdout);
            console.error('Error stderr:', execError.stderr);
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

        console.log('✓ Graph generated successfully with', graphData.nodes?.length, 'nodes');
        res.json({
            success: true,
            graph: graphData,
            message: `Graph generated with ${nodeCount} nodes using ${method} method`
        });

    } catch (error) {
        console.error('✗ Error in /generateGraph:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Find path endpoint
app.post('/findPath', async (req, res) => {
    try {
        console.log('=== Find Path Request ===');
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
            console.log('✓ Graph file exists');
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
        console.log('✓ Route input written to:', routeInputPath);

        // Execute Dijkstra's algorithm
        const dijkstraPath = path.join(backendBuildDir, 'dijkstra');
        
        console.log('Dijkstra path:', dijkstraPath);
        
        // Check if dijkstra exists and is executable
        try {
            await fs.access(dijkstraPath);
            console.log('✓ Dijkstra executable found');
            
            // Check if it's executable
            const stats = await fs.stat(dijkstraPath);
            const isExecutable = !!(stats.mode & 0o111);
            console.log('Dijkstra is executable:', isExecutable);
            
            if (!isExecutable) {
                console.log('⚠ Dijkstra not executable, fixing permissions...');
                await fs.chmod(dijkstraPath, 0o755);
            }
        } catch (error) {
            console.error('✗ Dijkstra executable not found or inaccessible:', error);
            return res.status(500).json({
                success: false,
                message: 'Dijkstra executable not found on server'
            });
        }
        
        try {
            console.log('🚀 Executing Dijkstra...');
            const { stdout, stderr } = await execAsync(`cd "${dataDir}" && "${dijkstraPath}"`);
            console.log('✓ Dijkstra executed successfully');
            if (stdout) console.log('Dijkstra stdout:', stdout);
            if (stderr) console.log('Dijkstra stderr:', stderr);
        } catch (execError) {
            console.error('✗ Dijkstra execution failed:', execError);
            console.error('Error stdout:', execError.stdout);
            console.error('Error stderr:', execError.stderr);
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

        console.log('✓ Pathfinding completed:', pathResult.success ? 'SUCCESS' : 'FAILED');
        res.json(pathResult);

    } catch (error) {
        console.error('✗ Error in /findPath:', error);
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
        console.log('✓ Graph saved to:', filePath);

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
    console.log('🚀 Starting Graph Visualization Server...');
    
    await ensureDirectories();
    await ensureDataFiles();
    await startupChecks();
    
    app.listen(port, () => {
        console.log('=================================');
        console.log('Graph Visualization Server');
        console.log('=================================');
        console.log(`✅ Server running on port: ${port}`);
        console.log(`📁 Data directory: ${dataDir}`);
        console.log(`💾 Saved graphs: ${savedGraphsDir}`);
        console.log(`⚙️  Backend build: ${backendBuildDir}`);
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