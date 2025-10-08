#ifndef GRAPH_H
#define GRAPH_H

#include <string>
#include <vector>
#include <unordered_map>
#include <fstream>
#include "json.hpp"

using json = nlohmann::json;
using namespace std;

struct Node {
    int id;
    double x, y;  // Position for visualization
};

struct Edge {
    int from;
    int to;
    int weight;
};

class Graph {
private:
    string name;
    vector<Node> nodes;
    unordered_map<int, vector<pair<int, int>>> adjacencyList; // node -> [(neighbor, weight)]
    unordered_map<int, unordered_map<int, int>> edgeWeights;  // from -> (to -> weight)

public:
    Graph();
    Graph(const string& graphName);
    
    // Core graph operations
    void addNode(int id, double x = 0.0, double y = 0.0);
    void addEdge(int from, int to, int weight);
    void removeEdge(int from, int to);
    
    // Accessors
    const vector<Node>& getNodes() const;
    const vector<pair<int, int>> getNeighbors(int node) const;
    int getEdgeWeight(int from, int to) const;
    bool hasEdge(int from, int to) const;
    int getNodeCount() const;
    int getEdgeCount() const;
    
    // Name management
    void setName(const string& newName);
    const string& getName() const;
    
    // Node position management
    void setNodePosition(int nodeId, double x, double y);
    Node getNode(int nodeId) const;
    
    // File I/O
    bool writeToFile(const string& filepath) const;
    bool readFromFile(const string& filepath);
    
    // JSON serialization/deserialization
    json toJson() const;
    void fromJson(const json& j);
    
    // Utility
    void clear();
    bool isEmpty() const;
};

#endif