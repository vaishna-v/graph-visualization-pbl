#ifndef MINHEAP_H
#define MINHEAP_H

#include <vector>
#include <unordered_map>
#include <stdexcept>

using namespace std;

struct HeapNode {
    int nodeId;
    int distance;
    
    HeapNode(int id, int dist) : nodeId(id), distance(dist) {}
    
    // Comparison operator for min-heap
    bool operator>(const HeapNode& other) const {
        return distance > other.distance;
    }
};

class MinHeap {
private:
    vector<HeapNode> heap;
    unordered_map<int, int> nodeToIndex; // nodeId -> index in heap
    
    // Helper methods
    void bubbleUp(int index);
    void bubbleDown(int index);
    void swapNodes(int index1, int index2);
    
public:
    MinHeap();
    
    // Core operations
    void addNode(int nodeId, int distance);
    HeapNode deleteRoot();
    void decreaseKey(int nodeId, int newDistance);
    
    // Accessors
    bool isEmpty() const;
    int size() const;
    bool contains(int nodeId) const;
    int getDistance(int nodeId) const;
    
    // Utility
    void clear();
};

#endif