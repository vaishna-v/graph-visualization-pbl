#include "graph.h"
#include "minheap.h"
#include "json.hpp"
#include <iostream>
#include <fstream>
#include <vector>
#include <unordered_map>
#include <limits>
#include <algorithm>

using json = nlohmann::json;
using namespace std;

struct PathfindingResult {
    vector<int> path;
    int totalDistance;
    int totalBatteryUsed;
    bool success;
    string message;
};

PathfindingResult dijkstraWithBattery(const Graph& graph, int source, int destination, int initialBattery, int mileage) {
    PathfindingResult result;
    result.success = false;
    
    // Validate inputs
    if (source == destination) {
        result.message = "Source and destination are the same";
        result.path = {source};
        result.totalDistance = 0;
        result.totalBatteryUsed = 0;
        result.success = true;
        return result;
    }
    
    // Check if nodes exist
    try {
        graph.getNode(source);
        graph.getNode(destination);
    } catch (const out_of_range& e) {
        result.message = "Invalid source or destination node";
        return result;
    }
    
    int n = graph.getNodeCount();
    if (n == 0) {
        result.message = "Graph is empty";
        return result;
    }
    
    // Initialize data structures
    unordered_map<int, int> distances;
    unordered_map<int, int> batteryUsed;
    unordered_map<int, int> previous;
    MinHeap minHeap;
    
    // Initialize all nodes
    const auto& nodes = graph.getNodes();
    for (const auto& node : nodes) {
        int nodeId = node.id;
        distances[nodeId] = numeric_limits<int>::max();
        batteryUsed[nodeId] = numeric_limits<int>::max();
        previous[nodeId] = -1;
    }
    
    // Start from source node
    distances[source] = 0;
    batteryUsed[source] = 0;
    minHeap.addNode(source, 0);
    
    // Dijkstra's algorithm
    while (!minHeap.isEmpty()) {
        HeapNode current = minHeap.deleteRoot();
        int currentNode = current.nodeId;
        
        // Stop if we reached destination
        if (currentNode == destination) {
            break;
        }
        
        // Explore neighbors
        const auto& neighbors = graph.getNeighbors(currentNode);
        for (const auto& neighbor : neighbors) {
            int neighborNode = neighbor.first;
            int edgeWeight = neighbor.second;
            
            // Calculate battery consumption for this edge
            int batteryConsumption = edgeWeight / mileage; // Simplified battery model
            if (batteryConsumption < 1) batteryConsumption = 1; // Minimum consumption
            
            int newBatteryUsed = batteryUsed[currentNode] + batteryConsumption;
            int newDistance = distances[currentNode] + edgeWeight;
            
            // Check if this path is better and doesn't exceed battery
            if (newBatteryUsed <= initialBattery && newDistance < distances[neighborNode]) {
                distances[neighborNode] = newDistance;
                batteryUsed[neighborNode] = newBatteryUsed;
                previous[neighborNode] = currentNode;
                
                if (minHeap.contains(neighborNode)) {
                    minHeap.decreaseKey(neighborNode, newDistance);
                } else {
                    minHeap.addNode(neighborNode, newDistance);
                }
            }
        }
    }
    
    // Reconstruct path if destination is reachable
    if (distances[destination] == numeric_limits<int>::max()) {
        result.message = "No path exists within battery constraints";
        return result;
    }
    
    // Build path from destination to source
    vector<int> path;
    int current = destination;
    while (current != -1) {
        path.push_back(current);
        current = previous[current];
    }
    reverse(path.begin(), path.end());
    
    result.path = path;
    result.totalDistance = distances[destination];
    result.totalBatteryUsed = batteryUsed[destination];
    result.success = true;
    result.message = "Path found successfully";
    
    return result;
}

int main() {
    try {
        // Read graph from file - try multiple paths
        Graph graph;
        bool readSuccess = graph.readFromFile("graph.json");
        if (!readSuccess) {
            readSuccess = graph.readFromFile("../../data/graph.json");
        }
        
        if (!readSuccess) {
            cerr << "Error: Could not read graph from graph.json" << endl;
            return 1;
        }
        
        // Read pathfinding input - try multiple paths
        ifstream inputFile("route_input.json");
        if (!inputFile.is_open()) {
            inputFile.open("../../data/route_input.json");
            if (!inputFile.is_open()) {
                cerr << "Error: Could not open route_input.json" << endl;
                return 1;
            }
        }
        
        json input;
        inputFile >> input;
        inputFile.close();
        
        // Extract parameters
        int source = input.value("source", 1);
        int destination = input.value("destination", 2);
        int initialBattery = input.value("battery", 100);
        int mileage = input.value("mileage", 10);
        
        if (initialBattery <= 0 || mileage <= 0) {
            cerr << "Error: Battery and mileage must be positive" << endl;
            return 1;
        }
        
        // Run Dijkstra's algorithm
        PathfindingResult result = dijkstraWithBattery(graph, source, destination, initialBattery, mileage);
        
        // Prepare output
        json output;
        output["success"] = result.success;
        output["message"] = result.message;
        
        if (result.success) {
            output["path"] = result.path;
            output["totalDistance"] = result.totalDistance;
            output["totalBatteryUsed"] = result.totalBatteryUsed;
            output["batteryRemaining"] = initialBattery - result.totalBatteryUsed;
        }
        
        // Write result to file - try multiple paths
        ofstream outputFile("route.json");
        if (!outputFile.is_open()) {
            outputFile.open("../../data/route.json");
            if (!outputFile.is_open()) {
                cerr << "Error: Could not open route.json for writing" << endl;
                return 1;
            }
        }
        
        outputFile << output.dump(4);
        outputFile.close();
        
        if (result.success) {
            cout << "Path found: ";
            for (size_t i = 0; i < result.path.size(); i++) {
                cout << result.path[i];
                if (i < result.path.size() - 1) cout << " -> ";
            }
            cout << "\nTotal distance: " << result.totalDistance << endl;
            cout << "Battery used: " << result.totalBatteryUsed << "/" << initialBattery << endl;
        } else {
            cout << "Pathfinding failed: " << result.message << endl;
        }
        
        return 0;
        
    } catch (const exception& e) {
        cerr << "Error in pathfinding: " << e.what() << endl;
        return 1;
    }
}