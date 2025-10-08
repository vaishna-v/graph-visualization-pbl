// uiController.js - User interface controller and DOM manipulation
class UIController {
    constructor(app) {
        this.app = app;
        this.selectedNodes = {
            source: null,
            destination: null
        };
        
        this.initializeUI();
        this.setupEventListeners();
    }

    // Initialize UI elements and state
    initializeUI() {
        // Set default values
        document.getElementById('node-count').value = '100';
        document.getElementById('source-node').value = '2';
        document.getElementById('destination-node').value = '92';
        document.getElementById('battery').value = '100';
        document.getElementById('mileage').value = '10';
        document.getElementById('save-graph-name').value = '';

        // Initialize tooltips
        this.initializeTooltips();
        
        // Clear any existing messages
        this.clearMessages();
    }

    // Setup UI-specific event listeners
    setupEventListeners() {
        

        // Refresh saved graphs list
        document.getElementById('refresh-graphs-btn').addEventListener('click', () => {
            this.app.loadSavedGraphsList();
        });

        // Clear path highlights
        document.getElementById('clear-path-btn').addEventListener('click', () => {
            this.clearPathResults();
            this.app.graphRenderer.clearHighlight();
        });

        



    }

    // Initialize Bootstrap-like tooltips
    initializeTooltips() {
        // You can add tooltip initialization here if using a library
        // For now, we'll use title attributes for basic tooltips
    }


    // Handle node click from graph renderer
    handleNodeClick(nodeId) {
        const sourceInput = document.getElementById('source-node');
        const destinationInput = document.getElementById('destination-node');
        
        // If no node selected yet, set as source
        if (!this.selectedNodes.source && !this.selectedNodes.destination) {
            this.selectedNodes.source = nodeId;
            sourceInput.value = nodeId;
            this.highlightNodeInGraph(nodeId, 'source');
        }
        // If source is selected but not destination, set as destination
        else if (this.selectedNodes.source && !this.selectedNodes.destination) {
            this.selectedNodes.destination = nodeId;
            destinationInput.value = nodeId;
            this.highlightNodeInGraph(nodeId, 'destination');
        }
        // If both are selected, reset and start over
        else {
            this.clearNodeSelection();
            this.selectedNodes.source = nodeId;
            sourceInput.value = nodeId;
            this.highlightNodeInGraph(nodeId, 'source');
        }
        
        this.updateNodeSelectionDisplay();
    }

    // Handle graph background click
    handleGraphClick() {
        this.clearNodeSelection();
        this.updateNodeSelectionDisplay();
    }

    // Highlight node in the graph with different colors
    highlightNodeInGraph(nodeId, type) {
        const nodeElement = this.app.graphRenderer.nodesGroup
            .selectAll('circle')
            .filter(d => d.id === nodeId);
            
        if (!nodeElement.empty()) {
            const color = type === 'source' ? '#2196F3' : '#FF5722'; // Blue for source, Orange for destination
            
            nodeElement
                .attr('stroke', color)
                .attr('stroke-width', 3)
                .transition()
                .duration(500)
                .attr('r', 25)
                .transition()
                .duration(500)
                .attr('r', 22);
        }
    }

    // Clear node selection highlights
    clearNodeSelection() {
        this.selectedNodes.source = null;
        this.selectedNodes.destination = null;
        
        // Reset all nodes to default style
        this.app.graphRenderer.nodesGroup.selectAll('circle')
            .attr('stroke', '#CC8400')
            .attr('stroke-width', 2)
            .attr('r', 20);
    }

    

    // Set loading state for buttons
    setLoadingState(isLoading, type = 'graph') {
        let button, originalText;

        switch (type) {
            case 'graph':
                button = document.getElementById('generate-graph-btn');
                originalText = 'Generate Graph';
                break;
            case 'pathfinding':
                button = document.getElementById('find-path-btn');
                originalText = 'Find Path';
                break;
            default:
                return;
        }

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Loading...';
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.textContent = originalText;
            button.classList.remove('loading');
        }
    }

    // Update graph information display
    updateGraphInfo(graphData) {
        if (!graphData) return;

        const graphInfoElement = document.getElementById('graph-info');
        const nodeCount = graphData.nodes ? graphData.nodes.length : 0;
        const edgeCount = graphData.edges ? graphData.edges.length : 0;
        const graphName = graphData.name || 'Unnamed Graph';

        graphInfoElement.innerHTML = `
            <div class="graph-stats">
                <h4>${graphName}</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Nodes:</span>
                        <span class="stat-value">${nodeCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Edges:</span>
                        <span class="stat-value">${edgeCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Density:</span>
                        <span class="stat-value">${this.calculateGraphDensity(nodeCount, edgeCount).toFixed(3)}</span>
                    </div>
                </div>
            </div>
        `;

        // Update node range in pathfinding inputs
        this.updateNodeRange(nodeCount);
    }

    // Calculate graph density
    calculateGraphDensity(nodeCount, edgeCount) {
        if (nodeCount < 2) return 0;
        const maxEdges = nodeCount * (nodeCount - 1) / 2;
        return edgeCount / maxEdges;
    }

    // Update the valid node range for pathfinding inputs
    updateNodeRange(maxNode) {
        const sourceInput = document.getElementById('source-node');
        const destinationInput = document.getElementById('destination-node');

        sourceInput.setAttribute('max', maxNode);
        destinationInput.setAttribute('max', maxNode);

        // Update placeholders
        sourceInput.placeholder = `1-${maxNode}`;
        destinationInput.placeholder = `1-${maxNode}`;

        // Validate current values
        if (parseInt(sourceInput.value) > maxNode) {
            sourceInput.value = '1';
            this.selectedNodes.source = 1;
        }
        if (parseInt(destinationInput.value) > maxNode) {
            destinationInput.value = Math.min(2, maxNode);
            this.selectedNodes.destination = parseInt(destinationInput.value);
        }


    }

    // Display pathfinding results
    displayPathResults(pathResult) {
        const pathResultsElement = document.getElementById('path-results');
        
        if (!pathResult.success) {
            pathResultsElement.innerHTML = `
                <div class="path-result error">
                    <h4>No Path Found</h4>
                    <p>${pathResult.message}</p>
                </div>
            `;
            return;
        }

        const pathString = pathResult.path.join(' → ');
        const batteryRemaining = pathResult.batteryRemaining || 0;

        pathResultsElement.innerHTML = `
            <div class="path-result success">
                <h4>✓ Path Found Successfully</h4>
                <div class="path-details">
                    <div class="path-route">
                        <strong>Route:</strong> ${pathString}
                    </div>
                    <div class="path-metrics">
                        <div class="metric">
                            <span class="metric-label">Total Distance:</span>
                            <span class="metric-value">${pathResult.totalDistance}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Battery Used:</span>
                            <span class="metric-value">${pathResult.totalBatteryUsed}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Battery Remaining:</span>
                            <span class="metric-value ${batteryRemaining < 20 ? 'low-battery' : ''}">${batteryRemaining}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Clear path results display
    clearPathResults() {
        const pathResultsElement = document.getElementById('path-results');
        pathResultsElement.innerHTML = `
            <div class="path-result initial">
                <h4>Path Results</h4>
                <p>Execute pathfinding to see results here.</p>
            </div>
        `;
        
        this.clearNodeSelection();
        document.getElementById('source-node').value = '1';
        document.getElementById('destination-node').value = '92';
    }

    // Update saved graphs dropdown list
    updateSavedGraphsList(graphs) {
        const selectElement = document.getElementById('load-graph-select');
        
        // Clear existing options except the first one
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }

        if (graphs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No saved graphs';
            option.disabled = true;
            selectElement.appendChild(option);
            return;
        }

        // Add saved graphs to dropdown
        graphs.forEach(graph => {
            const option = document.createElement('option');
            option.value = graph;
            option.textContent = graph.replace('.json', '');
            selectElement.appendChild(option);
        });

        // Update graphs count display
        const graphsCountElement = document.getElementById('saved-graphs-count');
        graphsCountElement.textContent = `(${graphs.length} saved)`;
    }

    // Show success message
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    // Show error message
    showError(message) {
        this.showMessage(message, 'error');
    }

    // Show message to user
    showMessage(message, type = 'info') {
        const messageElement = document.getElementById('message-area');
        
        messageElement.innerHTML = `
            <div class="message ${type}">
                <span class="message-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
                <span class="message-text">${message}</span>
                <button class="message-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;

        // Auto-remove success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageElement.contains(messageElement.firstChild)) {
                    messageElement.firstChild.remove();
                }
            }, 3000);
        }
    }

    // Clear all messages
    clearMessages() {
        const messageElement = document.getElementById('message-area');
        messageElement.innerHTML = '';
    }

    // Validate numeric input
    validateNumericInput(inputElement, min, max) {
        let value = parseInt(inputElement.value);
        
        if (isNaN(value)) {
            value = min;
        }
        
        value = Math.max(min, Math.min(max, value));
        inputElement.value = value;
        
        return value;
    }

    // Get current form values
    getFormValues() {
        return {
            nodeCount: parseInt(document.getElementById('node-count').value),
            method: document.getElementById('graph-method').value,
            source: parseInt(document.getElementById('source-node').value),
            destination: parseInt(document.getElementById('destination-node').value),
            battery: parseInt(document.getElementById('battery').value),
            mileage: parseInt(document.getElementById('mileage').value),
            saveName: document.getElementById('save-graph-name').value.trim()
        };
    }
}