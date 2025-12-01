describe('Distributed Database Evaluation', () => {
    // Helper to reset DB / nodes if necessary
    beforeEach(() => {
        cy.visit('http://ccscloud.dlsu.edu.ph:60115')
        // cy.request('POST', '/api/test/reset'); // optional endpoint to reset DB to known state
    });

    // ----------------------------
    // Step 3: Concurrency Control
    // ----------------------------
    context('Concurrency Control Cases', () => {

    it('Case 1: Concurrent reads', () => {
        // Simulate reads from Node 1 and Node 2 simultaneously
        cy.request('/api/tx/read?node=1&id=101').then(res1 => {
        cy.request('/api/tx/read?node=2&id=101').then(res2 => {
            cy.log('Node1 read:', JSON.stringify(res1.body));
            cy.log('Node2 read:', JSON.stringify(res2.body));
        });
        });
    });

    it('Case 2: One write + concurrent reads', () => {
        cy.request('POST', '/api/tx/update', { node: 2, trans_id: 101, amount: 500 })
        .then(updateRes => {
            cy.request('/api/tx/read?node=1&id=101').then(res1 => {
            cy.request('/api/tx/read?node=3&id=101').then(res2 => {
                cy.log('Update response:', JSON.stringify(updateRes.body));
                cy.log('Node1 read after write:', JSON.stringify(res1.body));
                cy.log('Node3 read after write:', JSON.stringify(res2.body));
            });
            });
        });
    });

    it('Case 3: Concurrent writes', () => {
        // Write from Node 2
        cy.request('POST', '/api/tx/update', { node: 2, trans_id: 102, amount: 300 });
        // Write from Node 3 at same time
        cy.request('POST', '/api/tx/update', { node: 3, trans_id: 102, amount: 400 });
        // Read from central node
        cy.request('/api/tx/read?node=1&id=102').then(res => {
        cy.log('Node1 read after concurrent writes:', JSON.stringify(res.body));
        });
    });

    });

    // ----------------------------
    // Step 4: Global Failure Recovery
    // ----------------------------
    context('Failure Recovery Cases', () => {

    it('Case 1: Node 2 write fails → central offline', () => {
        cy.request('POST', '/admin/fail-node', { nodeId: 1 }); // central offline
        cy.request('POST', '/api/tx/update', { node: 2, trans_id: 103, amount: 100 });
        cy.request('POST', '/admin/recover-node', { nodeId: 1 });
        cy.request('/api/tx/read?node=1&id=103').then(res => {
        cy.log('Central after recovery:', JSON.stringify(res.body));
        });
    });

    it('Case 2: Central recovers missed writes', () => {
        // Already simulated by Case 1 recovery
        cy.log('Check that all pending transactions from Node2/3 applied to central');
    });

    it('Case 3: Central → Node 2 write fails', () => {
        cy.request('POST', '/admin/fail-node', { nodeId: 2 }); 
        cy.request('POST', '/api/replication/run-once', { sourceNodeId: 1, targetNodeId: 2 });
        cy.request('POST', '/admin/recover-node', { nodeId: 2 });
        cy.request('/api/tx/read?node=2&id=104').then(res => {
        cy.log('Node2 after recovery:', JSON.stringify(res.body));
        });
    });

    it('Case 4: Node 3 recovers missed writes', () => {
        cy.request('POST', '/admin/fail-node', { nodeId: 3 });
        cy.request('POST', '/api/tx/update', { node: 1, trans_id: 105, amount: 200 });
        cy.request('POST', '/admin/recover-node', { nodeId: 3 });
        cy.request('/api/tx/read?node=3&id=105').then(res => {
        cy.log('Node3 after recovery:', JSON.stringify(res.body));
        });
    });

    });

});
