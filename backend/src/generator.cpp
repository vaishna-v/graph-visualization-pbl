#include "graph.h"
#include "json.hpp"
#include <iostream>
#include <fstream>
#include <random>
#include <string>
#include <cmath>
#include <ctime>

using json = nlohmann::json;
using namespace std;

// Random number generator
random_device rd;
mt19937 gen(rd());

Graph generateRandomGraph(int n) {
    Graph graph("Random_Graph_" + to_string(n) + "_" + to_string(time(0)));
    
    // Add nodes with positions in a 2D space (not completely random)
    uniform_real_distribution<double> posDist(50.0, 750.0); // Leave some margin
    uniform_real_distribution<double> clusterDist(0.0, 1.0);
    
    // Create some natural clustering
    vector<pair<double, double>> clusters;
    int clusterCount = max(3, n / 10); // More nodes = more clusters
    for (int i = 0; i < clusterCount; i++) {
        clusters.push_back({posDist(gen), posDist(gen)});
    }
    
    for (int i = 1; i <= n; i++) {
        // Assign nodes to clusters for more natural distribution
        int clusterIdx = static_cast<int>(clusterDist(gen) * clusterCount);
        double clusterX = clusters[clusterIdx].first;
        double clusterY = clusters[clusterIdx].second;
        
        // Add some variation around cluster center
        normal_distribution<double> varDist(0.0, 100.0);
        double x = max(50.0, min(750.0, clusterX + varDist(gen)));
        double y = max(50.0, min(750.0, clusterY + varDist(gen)));
        
        graph.addNode(i, x, y);
    }
    
    // Generate edges with distance-based probability
    uniform_int_distribution<int> weightDist(10, 200); // Wider weight range
    uniform_real_distribution<double> probDist(0.0, 1.0);
    
    // Calculate connection range based on graph size
    double maxConnectionDistance = 300.0 * sqrt(n) / 10.0; // Scales with n
    
    for (int i = 1; i <= n; i++) {
        Node nodeI = graph.getNode(i);
        int connections = 0;
        int maxConnections = min(n-1, static_cast<int>(sqrt(n) * 3)); // Limit connections per node
        
        for (int j = i + 1; j <= n && connections < maxConnections; j++) {
            Node nodeJ = graph.getNode(j);
            
            // Calculate Euclidean distance between nodes
            double dx = nodeI.x - nodeJ.x;
            double dy = nodeI.y - nodeJ.y;
            double distance = sqrt(dx*dx + dy*dy);
            
            // Higher probability for closer nodes, but allow some longer connections
            double connectionProb;
            if (distance < maxConnectionDistance * 0.3) {
                connectionProb = 0.7; // High probability for very close nodes
            } else if (distance < maxConnectionDistance * 0.6) {
                connectionProb = 0.4; // Medium probability for moderately close nodes
            } else if (distance < maxConnectionDistance) {
                connectionProb = 0.1; // Low probability for distant but connectable nodes
            } else {
                connectionProb = 0.02; // Very low probability for very distant nodes
            }
            
            // Add some randomness
            connectionProb *= (0.8 + probDist(gen) * 0.4);
            
            if (probDist(gen) < connectionProb && !graph.hasEdge(i, j)) {
                // Weight proportional to distance with some randomness
                int baseWeight = static_cast<int>(distance / 5.0);
                int weight = max(10, min(200, baseWeight + weightDist(gen) % 30));
                graph.addEdge(i, j, weight);
                connections++;
            }
        }
        
        // Ensure each node has at least 1 connection (graph connectivity)
        if (connections == 0 && i < n) {
            // Connect to nearest unconnected node
            int nearest = -1;
            double minDist = numeric_limits<double>::max();
            
            for (int j = i + 1; j <= n; j++) {
                if (!graph.hasEdge(i, j)) {
                    Node nodeJ = graph.getNode(j);
                    double dx = nodeI.x - nodeJ.x;
                    double dy = nodeI.y - nodeJ.y;
                    double distance = sqrt(dx*dx + dy*dy);
                    
                    if (distance < minDist) {
                        minDist = distance;
                        nearest = j;
                    }
                }
            }
            
            if (nearest != -1) {
                int weight = max(10, static_cast<int>(minDist / 5.0));
                graph.addEdge(i, nearest, weight);
            }
        }
    }
    
    return graph;
}

Graph generateSlidingWindowGraph(int n) {
    Graph graph("Sliding_Window_Graph_" + to_string(n) + "_" + to_string(time(0)));
    
    // Add nodes with positions in a roughly linear layout
    uniform_real_distribution<double> posDist(0.0, 800.0);
    uniform_real_distribution<double> yVar(-50.0, 50.0); // Y variation
    
    for (int i = 1; i <= n; i++) {
        double x = (i - 1) * (700.0 / (n - 1)) + 50.0; // Spread nodes horizontally
        double y = 400.0 + yVar(gen); // Center with some variation
        graph.addNode(i, x, y);
    }
    
    // Calculate window size (approximately sqrt(n) on each side)
    int windowSize = static_cast<int>(sqrt(n));
    if (windowSize < 1) windowSize = 1;
    
    uniform_int_distribution<int> weightDist(1, 100);
    uniform_real_distribution<double> probDist(0.0, 1.0);
    
    for (int i = 1; i <= n; i++) {
        // Connect to nodes within the sliding window
        for (int j = max(1, i - windowSize); j <= min(n, i + windowSize); j++) {
            if (i != j) {
                // Higher probability for closer nodes
                int distance = abs(i - j);
                double connectionProb = 0.8 * exp(-distance / (windowSize / 2.0));
                
                if (probDist(gen) < connectionProb) {
                    int weight = weightDist(gen);
                    graph.addEdge(i, j, weight);
                }
            }
        }
        
        // Add occasional long-distance connections (10% chance per node)
        if (probDist(gen) < 0.1) {
            uniform_int_distribution<int> distantNodeDist(1, n);
            int distantNode = distantNodeDist(gen);
            if (distantNode != i && !graph.hasEdge(i, distantNode)) {
                int weight = weightDist(gen) + 50; // Longer edges have higher weights
                graph.addEdge(i, distantNode, weight);
            }
        }
    }
    
    return graph;
}

Graph createGraph(int n, const string& method) {
    if (method == "random") {
        return generateRandomGraph(n);
    } else if (method == "sliding_window") {
        return generateSlidingWindowGraph(n);
    } else {
        throw invalid_argument("Unknown graph generation method: " + method);
    }
}

int main() {
    try {
        // Read input from JSON file - use relative path
        ifstream inputFile("graph_input.json");
        if (!inputFile.is_open()) {
            // Try alternative path
            inputFile.open("../../data/graph_input.json");
            if (!inputFile.is_open()) {
                cerr << "Error: Could not open graph_input.json" << endl;
                return 1;
            }
        }
        
        json input;
        inputFile >> input;
        inputFile.close();
        
        // Extract parameters
        int nodeCount = input.value("nodeCount", 10);
        string method = input.value("method", "random");
        
        if (nodeCount <= 0) {
            cerr << "Error: Invalid node count: " << nodeCount << endl;
            return 1;
        }
        
        // Generate graph
        Graph graph = createGraph(nodeCount, method);
        
        // Write graph to output file - try multiple paths
        bool writeSuccess = graph.writeToFile("graph.json");
        if (!writeSuccess) {
            writeSuccess = graph.writeToFile("../../data/graph.json");
        }
        
        if (!writeSuccess) {
            cerr << "Error: Could not write graph to graph.json" << endl;
            return 1;
        }
        
        cout << "Successfully generated " << method << " graph with " << nodeCount << " nodes" << endl;
        return 0;
        
    } catch (const exception& e) {
        cerr << "Error in graph generation: " << e.what() << endl;
        return 1;
    }
}