const NODE1 = "http://ccscloud.dlsu.edu.ph:60115/";
const NODE2 = "http://ccscloud.dlsu.edu.ph:60116/";
const NODE3 = "http://ccscloud.dlsu.edu.ph:60117/";

const ISOLATION_LEVELS = [
    "READ UNCOMMITTED"
    // "READ COMMITTED",
    // "REPEATABLE READ",
    // "SERIALIZABLE"
];

describe("MCO2 Distributed Database Concurrency and Recovery", () => {
    ISOLATION_LEVELS.forEach(level => {
        describe(`=== Isolation Level: ${level} ===`, () => {
            // CASE 1: Concurrent Reads
            // it("Case 1: Concurrent Reads on same item", () => {
            //     cy.log("Testing concurrent READS...");
            //     if(level == "READ UNCOMMITTED") {
            //         cy.visit(NODE1 + 'concurrency')
            //         // cy.visit(NODE1)
            //         // cy.contains('a', 'Concurrency Demo').click();
            //         cy.get('#txA-node').select('Node 1 (central)');
            //         cy.get('#txA-iso').select(`${level}`);
            //         cy.contains('button', 'Start Tx A').click();
            //         cy.contains('Started transaction').should('be.visible');
            //         cy.contains('button', 'READ').click();
                    // cy.contains('READ trans_id').should('be.visible');

            //         cy.origin(NODE2, { args: { level } }, ({ level }) => {
            //             cy.visit('concurrency')
            //             // cy.visit(NODE2)
            //             // cy.contains('a', 'Concurrency Demo').click();
            //             cy.get('#txA-node').select('Node 2 (fragment)');
            //             cy.get('#txA-iso').select(level);
            //             cy.contains('button', 'Start Tx A').click();
            //             cy.contains('Started transaction').should('be.visible');
            //             cy.contains('button', 'READ').click();
                        // cy.contains('READ trans_id').should('be.visible');
            //         });
            //     } else {
            //         cy.visit(NODE1 + 'concurrency')
            //         // cy.visit(NODE1)
            //         // cy.contains('a', 'Concurrency Demo').click();
            //         cy.get('#txA-node').select('Node 1 (central)');
            //         cy.get('#txA-iso').select(`${level}`);
            //         cy.contains('button', 'Start Tx A').click();
            //         cy.contains('Started transaction').should('be.visible');
            //         cy.contains('button', 'READ').click();
            //         cy.contains('READ trans_id').should('be.visible');
            //         cy.contains('button', 'Commit').click();
            //         cy.contains('COMMIT').should('be.visible');

            //         cy.origin(NODE2, { args: { level } }, ({ level }) => {
            //             cy.visit('concurrency')
            //             // cy.visit(NODE2)
            //             // cy.contains('a', 'Concurrency Demo').click();
            //             cy.get('#txA-node').select('Node 2 (fragment)');
            //             cy.get('#txA-iso').select(level);
            //             cy.contains('button', 'Start Tx A').click();
            //             cy.contains('Started transaction').should('be.visible');
            //             cy.contains('button', 'READ').click();
            //             cy.contains('READ trans_id').should('be.visible');
            //             cy.contains('button', 'Commit').click();
            //             cy.contains('COMMIT').should('be.visible');
            //         });
            //     }
            // });

            // CASE 2: Write + Read
            it("Case 2: Write on one node, Read on others", () => {
                cy.log("Testing Write + Read...");

                if(level == "READ UNCOMMITTED") {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'UPDATE').click();
                    // cy.contains('UPDATE trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                    });

                    cy.origin(NODE3, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 3 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                    });
                } else {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'UPDATE').click();
                    // cy.contains('UPDATE trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.contains('COMMIT').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });

                    cy.origin(NODE3, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 3 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });
                }
            });

            // CASE 3: Concurrent Writes
            it("Case 3: Concurrent Writes (Node2 vs Node3)", () => {
                cy.log("Testing concurrent WRITES...");
                if(level == "READ UNCOMMITTED") {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'UPDATE').click();
                    // cy.contains('UPDATE trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'UPDATE').click();
                        // cy.contains('UPDATE trans_id').should('be.visible');
                    });
                } else {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'UPDATE').click();
                    // cy.contains('UPDATE trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.contains('COMMIT').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'UPDATE').click();
                        // cy.contains('UPDATE trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });
                }
            });
        });
    });

    // STEP 4: FAILURE RECOVERY CASES
    describe("=== FAILURE RECOVERY TESTS ===", () => {
        // CASE 1: Node1 fails during replication
        it("Case 1: Node 1 fails during replication", () => {
            cy.log("Testing: Node1 down while Node2 writes.");
            // Turn off node1.
            // Update finishes on node2, but replication fails and is logged.
            // Check db to verify.
            // Show logs to verify.
        });

        // CASE 2: Node1 recovers after missing updates
        it("Case 2: Node1 recovers and gets missed writes", () => {
            cy.log("Testing: Node1 recovers from failure.");
            // Turn on node1.
            // Node1 application checks logs when turned back on.
            // Replication proceeds.
            // Check db to verify.
            // Show logs to verify.
        });

        // CASE 3: Node2 fails during replication from Node1
        it("Case 3: Node2 fails during central-node replication", () => {
            cy.log("Testing: Node2 down while Node1 writes.");
            // Turn off node2.
            // Update finishes on node1, but replication fails and is logged.
            // Check db to verify.
            // Show logs to verify.
        });

        // CASE 4: Node3 misses writes and recovers later
        it("Case 4: Node2 recovers and receives missed writes", () => {
            cy.log("Testing: Node2 recovers from failure.");
            // Turn on node2.
            // Node2 application checks logs when turned back on.
            // Replication proceeds.
            // Check db to verify.
            // Show logs to verify.
        });
    });
});