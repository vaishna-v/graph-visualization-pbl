// app.js - Main application controller
class GraphApp {
    constructor() {
        this.currentGraph = null;
        this.currentPath = null;
        this.savedGraphs = [];
        
        // Initialize components
        this.graphRenderer = new GraphRenderer('graph-container');
        this.uiController = new UIController(this);
        
        // Load saved graphs list and initialize
        this.loadSavedGraphsList();
        this.loadDefaultGraph();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Graph Visualization App initialized');
    }

    // Setup global event listeners
    setupEventListeners() {
        // Graph generation
        document.getElementById('generate-graph-btn').addEventListener('click', () => {
            this.generateGraph();
        });

        // Pathfinding
        document.getElementById('find-path-btn').addEventListener('click', () => {
            this.findPath();
        });

        // Save graph
        document.getElementById('save-graph-btn').addEventListener('click', () => {
            this.saveGraph();
        });

        // Load graph dropdown change
        document.getElementById('load-graph-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadGraph(e.target.value);
            }
        });

        // Enter key support for inputs
        document.getElementById('node-count').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.generateGraph();
        });

        document.getElementById('source-node').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.findPath();
        });

        document.getElementById('destination-node').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.findPath();
        });
    }

    // Generate a new graph based on user input
    async generateGraph() {
        const nodeCount = parseInt(document.getElementById('node-count').value);
        const method = document.getElementById('graph-method').value;
        
        if (!nodeCount || nodeCount < 2 || nodeCount > 500) {
            this.uiController.showError('Please enter a valid node count (2-500)');
            return;
        }

        this.uiController.setLoadingState(true);
        
        try {
            const response = await fetch('/generateGraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nodeCount: nodeCount,
                    method: method
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentGraph = result.graph;
                this.currentPath = null;
                this.graphRenderer.renderGraph(this.currentGraph);
                this.uiController.updateGraphInfo(this.currentGraph);
                this.uiController.clearPathResults();
                this.uiController.showSuccess('Graph generated successfully!');
            } else {
                this.uiController.showError(result.message || 'Failed to generate graph');
            }
        } catch (error) {
            console.error('Error generating graph:', error);
            this.uiController.showError('Network error: Could not generate graph');
        } finally {
            this.uiController.setLoadingState(false);
        }
    }

    // Find shortest path using Dijkstra's algorithm
    async findPath() {
        if (!this.currentGraph) {
            this.uiController.showError('Please generate or load a graph first');
            return;
        }

        const source = parseInt(document.getElementById('source-node').value);
        const destination = parseInt(document.getElementById('destination-node').value);
        const battery = parseInt(document.getElementById('battery').value);
        const mileage = parseInt(document.getElementById('mileage').value);

        // Validate inputs
        if (!source || !destination) {
            this.uiController.showError('Please enter both source and destination nodes');
            return;
        }

        if (source === destination) {
            this.uiController.showError('Source and destination cannot be the same');
            return;
        }

        if (!battery || battery <= 0) {
            this.uiController.showError('Please enter a valid battery level');
            return;
        }

        if (!mileage || mileage <= 0) {
            this.uiController.showError('Please enter a valid mileage');
            return;
        }

        this.uiController.setLoadingState(true, 'pathfinding');

        try {
            const response = await fetch('/findPath', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: source,
                    destination: destination,
                    battery: battery,
                    mileage: mileage
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentPath = result;
                this.graphRenderer.highlightPath(this.currentPath.path);
                this.uiController.displayPathResults(this.currentPath);
                this.uiController.showSuccess('Path found successfully!');
            } else {
                this.uiController.showError(result.message || 'No path found');
                this.graphRenderer.clearHighlight();
                this.uiController.clearPathResults();
            }
        } catch (error) {
            console.error('Error finding path:', error);
            this.uiController.showError('Network error: Could not find path');
        } finally {
            this.uiController.setLoadingState(false, 'pathfinding');
        }
    }

    // Save current graph
    async saveGraph() {
        if (!this.currentGraph) {
            this.uiController.showError('No graph to save');
            return;
        }

        const graphName = document.getElementById('save-graph-name').value.trim();
        if (!graphName) {
            this.uiController.showError('Please enter a graph name');
            return;
        }

        try {
            const response = await fetch('/saveGraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    graphName: graphName,
                    graph: this.currentGraph
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.uiController.showSuccess('Graph saved successfully!');
                document.getElementById('save-graph-name').value = '';
                this.loadSavedGraphsList(); // Refresh the list
            } else {
                this.uiController.showError(result.message || 'Failed to save graph');
            }
        } catch (error) {
            console.error('Error saving graph:', error);
            this.uiController.showError('Network error: Could not save graph');
        }
    }

    // Load a saved graph
    async loadGraph(graphName) {
        try {
            const response = await fetch('/loadGraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    graphName: graphName
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentGraph = result.graph;
                this.currentPath = null;
                this.graphRenderer.renderGraph(this.currentGraph);
                this.uiController.updateGraphInfo(this.currentGraph);
                this.uiController.clearPathResults();
                this.graphRenderer.clearHighlight();
                this.uiController.showSuccess(`Loaded graph: ${graphName}`);
            } else {
                this.uiController.showError(result.message || 'Failed to load graph');
            }
        } catch (error) {
            console.error('Error loading graph:', error);
            this.uiController.showError('Network error: Could not load graph');
        }
    }

    // Load list of saved graphs for dropdown
    async loadSavedGraphsList() {
        try {
            const response = await fetch('/listGraphs');
            const result = await response.json();
            
            if (result.success) {
                this.savedGraphs = result.graphs || [];
                this.uiController.updateSavedGraphsList(this.savedGraphs);
            }
        } catch (error) {
            console.error('Error loading saved graphs list:', error);
        }
    }

    // Load default graph on startup
    async loadDefaultGraph() {
        try {
            const response = await fetch('/generateGraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nodeCount: 100,
                    method: 'sliding_window' // or random
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentGraph = result.graph;
                this.graphRenderer.renderGraph(this.currentGraph);
                this.uiController.updateGraphInfo(this.currentGraph);
            }
        } catch (error) {
            console.error('Error loading default graph:', error);
            this.uiController.showError('Could not load default graph');
        }
    }

    // Handle node drag events from renderer
    onNodeDrag(nodeId, newX, newY) {
        if (this.currentGraph) {
            // Update node position in current graph data
            const nodeIndex = this.currentGraph.nodes.findIndex(node => node.id === nodeId);
            if (nodeIndex !== -1) {
                this.currentGraph.nodes[nodeIndex].x = newX;
                this.currentGraph.nodes[nodeIndex].y = newY;
            }
        }
    }

    // Handle node click events from renderer
    onNodeClick(nodeId) {
        this.uiController.handleNodeClick(nodeId);
    }

    // Handle graph click events from renderer
    onGraphClick() {
        this.uiController.handleGraphClick();
    }

    // Get current graph data
    getCurrentGraph() {
        return this.currentGraph;
    }

    // Get current path data
    getCurrentPath() {
        return this.currentPath;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.graphApp = new GraphApp();
});