const NODE1 = "http://ccscloud.dlsu.edu.ph:60115/";
const NODE2 = "http://ccscloud.dlsu.edu.ph:60116/";
const NODE3 = "http://ccscloud.dlsu.edu.ph:60117/";

const ISOLATION_LEVELS = [
    "SERIALIZABLE",
    "READ UNCOMMITTED",
    "READ COMMITTED",
    "REPEATABLE READ",
];

describe("MCO2 Distributed Database Concurrency", () => {
    ISOLATION_LEVELS.forEach(level => {
        describe(`=== Isolation Level: ${level} ===`, () => {
            beforeEach(() => {
                cy.wait(3000); // 3 seconds
            });
            
            // CASE 1: Concurrent Reads
            it("Case 1: Concurrent Reads on same item", () => {
                cy.log("Testing concurrent READS...");
                if(level == "READ UNCOMMITTED") {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait(3000); // 3 seconds
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.contains('READ trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait(3000); // 3 seconds
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
                    cy.wait(3000); // 3 seconds
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.contains('READ trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });

                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.contains('READ trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.contains('COMMIT').should('be.visible');
                    
                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });
                }
            });

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
                    cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                    cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });

                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                    cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
                    cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait(3000); // 3 seconds
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'UPDATE').click();
                        // cy.contains('UPDATE trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.contains('COMMIT').should('be.visible');
                    });

                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait(3000); // 3 seconds
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
                        cy.wait(3000); // 3 seconds
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
});