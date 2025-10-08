// graphRenderer.js - D3.js graph visualization and rendering
class GraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.graphGroup = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 800;
        this.height = 600;
        this.onNodeDrag = null;
        this.onNodeClick = null;
        this.onGraphClick = null;
        
        this.initializeSVG();
        this.setupZoom();
    }

    // Initialize SVG container and groups
    initializeSVG() {
        const container = d3.select(`#${this.containerId}`);
        
        // Clear existing content
        container.html('');
        
        // Create SVG
        this.svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .style('background-color', '#F7F7F7')
            .style('border-radius', '8px')
            .style('border', '1px solid #ddd');

        // Create zoom group
        this.zoomGroup = this.svg.append('g');

        // Create graph elements group
        this.graphGroup = this.zoomGroup.append('g');

        // Create links group (behind nodes)
        this.linksGroup = this.graphGroup.append('g')
            .attr('class', 'links');

        // Create nodes group (on top of links)
        this.nodesGroup = this.graphGroup.append('g')
            .attr('class', 'nodes');

        // Add click listener for background
        this.svg.on('click', (event) => {
            if (event.target === this.svg.node() && this.onGraphClick) {
                this.onGraphClick();
            }
        });
    }

    // Setup zoom and pan behavior
    setupZoom() {
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.zoomGroup.attr('transform', event.transform);
            });

        this.svg.call(zoom);
    }

    // Render the graph with force simulation
    renderGraph(graphData) {
        if (!graphData || !graphData.nodes || !graphData.edges) {
            console.error('Invalid graph data');
            return;
        }

        this.nodes = graphData.nodes.map(node => ({
            id: node.id,
            x: node.x || Math.random() * this.width,
            y: node.y || Math.random() * this.height,
            label: node.id.toString()
        }));

        this.links = graphData.edges.map(edge => ({
            source: edge.from,
            target: edge.to,
            weight: edge.weight,
            id: `${edge.from}-${edge.to}`
        }));

        this.updateGraph();
    }

    // Update graph elements with force simulation
    updateGraph() {
        // Clear existing elements
        this.linksGroup.selectAll('*').remove();
        this.nodesGroup.selectAll('*').remove();

        // Create links (edges)
        const link = this.linksGroup.selectAll('line')
            .data(this.links)
            .enter().append('line')
            .attr('class', 'edge')
            .attr('stroke', '#A0A0A0')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.8);

        // Create nodes
        const node = this.nodesGroup.selectAll('circle')
            .data(this.nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', 20)
            .attr('fill', '#FFA500')
            .attr('stroke', '#CC8400')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d))
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                if (this.onNodeClick) {
                    this.onNodeClick(d.id);
                }
            });

        // Add node labels
        const label = this.nodesGroup.selectAll('text')
            .data(this.nodes)
            .enter().append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '.3em')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', 'white')
            .attr('pointer-events', 'none')
            .text(d => d.label);

        // Initialize force simulation
        this.initializeForceSimulation(node, link, label);
    }

    // Initialize D3 force simulation
    initializeForceSimulation(node, link, label) {
        // Stop previous simulation if exists
        if (this.simulation) {
            this.simulation.stop();
        }

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(d => {
                    // Make edge length proportional to weight
                    const baseDistance = 100;
                    const weightFactor = d.weight ? Math.sqrt(d.weight) : 1;
                    return baseDistance * weightFactor;
                })
                .strength(0.1)
            )
            .force('charge', d3.forceManyBody()
                .strength(-300)
            )
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(25))
            .on('tick', () => {
                // Update link positions
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                // Update node positions
                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);

                // Update label positions
                label
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });

        // Set initial positions if they exist
        this.nodes.forEach(nodeData => {
            if (nodeData.x && nodeData.y) {
                nodeData.fx = nodeData.x;
                nodeData.fy = nodeData.y;
            }
        });

        // Release fixed positions after simulation stabilizes
        this.simulation.alpha(0.1).restart();
        setTimeout(() => {
            this.nodes.forEach(nodeData => {
                nodeData.fx = null;
                nodeData.fy = null;
            });
            this.simulation.alpha(0.1).restart();
        }, 1000);
    }

    // Drag event handlers
    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        
        // Notify about node drag
        if (this.onNodeDrag) {
            this.onNodeDrag(d.id, event.x, event.y);
        }
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        // Keep node fixed at dragged position
        d.fx = event.x;
        d.fy = event.y;
        
        // Final notification
        if (this.onNodeDrag) {
            this.onNodeDrag(d.id, event.x, event.y);
        }
    }

    // Highlight path found by Dijkstra's algorithm
    highlightPath(pathNodes) {
        if (!pathNodes || pathNodes.length === 0) return;

        // Clear previous highlights
        this.clearHighlight();

        // Highlight nodes in path
        this.nodesGroup.selectAll('circle')
            .filter(d => pathNodes.includes(d.id))
            .attr('fill', '#4CAF50')
            .attr('stroke', '#388E3C')
            .attr('stroke-width', 3);

        // Highlight edges in path
        const pathEdges = [];
        for (let i = 0; i < pathNodes.length - 1; i++) {
            const from = pathNodes[i];
            const to = pathNodes[i + 1];
            
            // Find the edge (check both directions for undirected graph)
            const edge = this.links.find(link => 
                (link.source.id === from && link.target.id === to) ||
                (link.source.id === to && link.target.id === from)
            );
            
            if (edge) {
                pathEdges.push(edge.id);
            }
        }

        this.linksGroup.selectAll('line')
            .filter(d => pathEdges.includes(d.id))
            .attr('stroke', '#4CAF50')
            .attr('stroke-width', 4)
            .attr('stroke-opacity', 1);

        // Add animation to path
        this.animatePath(pathNodes);
    }

    // Animate the path for better visualization
    animatePath(pathNodes) {
        // Pulse animation for path nodes
        this.nodesGroup.selectAll('circle')
            .filter(d => pathNodes.includes(d.id))
            .transition()
            .duration(1000)
            .attr('r', 25)
            .transition()
            .duration(1000)
            .attr('r', 20)
            .on('end', function() {
                d3.select(this).transition().attr('r', 22);
            });
    }

    // Clear all highlights
    clearHighlight() {
        // Reset all nodes to default style
        this.nodesGroup.selectAll('circle')
            .attr('fill', '#FFA500')
            .attr('stroke', '#CC8400')
            .attr('stroke-width', 2)
            .attr('r', 20);

        // Reset all edges to default style
        this.linksGroup.selectAll('line')
            .attr('stroke', '#A0A0A0')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.8);
    }

    // Update node positions (for saved graph layouts)
    updateNodePositions(nodePositions) {
        if (!nodePositions) return;

        this.nodes.forEach(node => {
            if (nodePositions[node.id]) {
                node.x = nodePositions[node.id].x;
                node.y = nodePositions[node.id].y;
                node.fx = node.x;
                node.fy = node.y;
            }
        });

        // Restart simulation with new positions
        if (this.simulation) {
            this.simulation.alpha(0.3).restart();
        }
    }

    // Get current node positions for saving
    getNodePositions() {
        const positions = {};
        this.nodes.forEach(node => {
            positions[node.id] = {
                x: node.x,
                y: node.y
            };
        });
        return positions;
    }

    // Reset zoom and pan to default
    resetView() {
        this.svg.transition()
            .duration(750)
            .call(
                this.svg.zoom().transform,
                d3.zoomIdentity
            );
    }

    // Fit graph to viewport
    fitToViewport() {
        const bounds = this.graphGroup.node().getBBox();
        const fullWidth = this.width;
        const fullHeight = this.height;
        const width = bounds.width;
        const height = bounds.height;
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;
        
        if (width === 0 || height === 0) return; // nothing to fit
        
        const scale = 0.9 / Math.max(width / fullWidth, height / fullHeight);
        const translate = [
            fullWidth / 2 - scale * midX,
            fullHeight / 2 - scale * midY
        ];
        
        this.svg.transition()
            .duration(750)
            .call(
                this.svg.zoom().transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
    }

    // Set callbacks for external events
    setCallbacks(onNodeDrag, onNodeClick, onGraphClick) {
        this.onNodeDrag = onNodeDrag;
        this.onNodeClick = onNodeClick;
        this.onGraphClick = onGraphClick;
    }

    // Clean up resources
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }
}