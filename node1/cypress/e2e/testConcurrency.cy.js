const NODE1 = "http://ccscloud.dlsu.edu.ph:60115/";
const NODE2 = "http://ccscloud.dlsu.edu.ph:60116/";
const NODE3 = "http://ccscloud.dlsu.edu.ph:60117/";

const ISOLATION_LEVELS = [
    "READ UNCOMMITTED",
    "READ COMMITTED",
    "REPEATABLE READ",
    "SERIALIZABLE",
];

describe("MCO2 Distributed Database Concurrency", () => {
    ISOLATION_LEVELS.forEach(level => {
        describe(`=== Isolation Level: ${level} ===`, () => {
            beforeEach(() => {
                cy.wait(3000); // 3 seconds
            });
            
            // cy.intercept('POST', '/api/tx/rollback').as('apiRollbackTx');
            
            // CASE 1: Concurrent Reads
            it("Case 1: Concurrent Reads on same item", () => {
                cy.log("Testing concurrent READS...");
                cy.intercept('POST', '**/api/tx/start').as('apiStartTx');
                cy.intercept('POST', '**/api/tx/read').as('apiReadTx');
                cy.intercept('POST', '**/api/tx/update').as('apiUpdateTx');
                cy.intercept('POST', '**/api/tx/commit').as('apiCommitTx');

                if(level == "READ UNCOMMITTED") {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait('@apiStartTx');
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.wait('@apiReadTx');
                        cy.contains('READ trans_id').should('be.visible');
                    });
                } else {
                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');

                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait('@apiStartTx');
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.wait('@apiReadTx');
                        cy.contains('READ trans_id').should('be.visible');
                        // cy.contains('button', 'Commit').click();
                        // cy.wait('@apiCommitTx');
                        // cy.contains('COMMIT').should('be.visible');
                    });

                    cy.visit(NODE1 + 'concurrency')
                    // cy.visit(NODE1)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 1 (central)');
                    cy.get('#txA-iso').select(`${level}`);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.wait('@apiCommitTx');
                    cy.contains('COMMIT').should('be.visible');
                    
                    cy.origin(NODE2, { args: { level } }, ({ level }) => {
                        cy.visit('concurrency')
                        // cy.visit(NODE2)
                        // cy.contains('a', 'Concurrency Demo').click();
                        cy.get('#txA-node').select('Node 2 (fragment)');
                        cy.get('#txA-iso').select(level);
                        cy.contains('button', 'Start Tx A').click();
                        cy.wait('@apiStartTx');
                        cy.contains('Started transaction').should('be.visible');
                        cy.contains('button', 'READ').click();
                        cy.wait('@apiReadTx');
                        cy.contains('READ trans_id').should('be.visible');
                        cy.contains('button', 'Commit').click();
                        cy.wait('@apiCommitTx');
                        cy.contains('COMMIT').should('be.visible');
                    });
                }
            });

            // CASE 2: Write + Read
            it("Case 2: Write on one node, Read on others", () => {
                cy.log("Testing Write + Read...");
                cy.intercept('POST', '**/api/tx/start').as('apiStartTx');
                cy.intercept('POST', '**/api/tx/read').as('apiReadTx');
                cy.intercept('POST', '**/api/tx/update').as('apiUpdateTx');
                cy.intercept('POST', '**/api/tx/commit').as('apiCommitTx');

                cy.visit(NODE1 + 'concurrency')
                // cy.visit(NODE1)
                // cy.contains('a', 'Concurrency Demo').click();
                cy.get('#txA-node').select('Node 1 (central)');
                cy.get('#txA-iso').select(`${level}`);
                cy.contains('button', 'Start Tx A').click();
                cy.wait('@apiStartTx');
                cy.contains('Started transaction').should('be.visible');
                cy.contains('button', 'READ').click();
                cy.wait('@apiReadTx');
                cy.contains('READ trans_id').should('be.visible');
                cy.contains('button', 'UPDATE').click();
                cy.wait('@apiUpdateTx');
                //cy.contains('UPDATE trans_id').should('be.visible');
                cy.contains('button', 'Commit').click();
                cy.wait('@apiCommitTx');
                cy.contains('COMMIT').should('be.visible');
                
                cy.origin(NODE2, { args: { level } }, ({ level }) => {
                    cy.visit('concurrency')
                    // cy.visit(NODE2)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 2 (fragment)');
                    cy.get('#txA-iso').select(level);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.wait('@apiCommitTx');
                    cy.contains('COMMIT').should('be.visible');
                });

                cy.origin(NODE3, { args: { level } }, ({ level }) => {
                    cy.visit('concurrency')
                    // cy.visit(NODE2)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 3 (fragment)');
                    cy.get('#txA-iso').select(level);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.wait('@apiCommitTx');
                    cy.contains('COMMIT').should('be.visible');
                });
                
                // if(level == "READ UNCOMMITTED") {
                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // // cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');

                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     // });

                //     // cy.origin(NODE3, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 3 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     // });
                // } else {
                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // //cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');

                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });

                //     // cy.origin(NODE3, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 3 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });

                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // //cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');
                    
                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });

                //     // cy.origin(NODE3, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 3 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });
                // }
            });

            // CASE 3: Concurrent Writes
            it("Case 3: Concurrent Writes (Node2 vs Node3)", () => {
                cy.log("Testing concurrent WRITES...");
                cy.intercept('POST', '**/api/tx/start').as('apiStartTx');
                cy.intercept('POST', '**/api/tx/read').as('apiReadTx');
                cy.intercept('POST', '**/api/tx/update').as('apiUpdateTx');
                cy.intercept('POST', '**/api/tx/commit').as('apiCommitTx');

                cy.visit(NODE1 + 'concurrency')
                // cy.visit(NODE1)
                // cy.contains('a', 'Concurrency Demo').click();
                cy.get('#txA-node').select('Node 1 (central)');
                cy.get('#txA-iso').select(`${level}`);
                cy.contains('button', 'Start Tx A').click();
                cy.wait('@apiStartTx');
                cy.contains('Started transaction').should('be.visible');
                cy.contains('button', 'READ').click();
                cy.wait('@apiReadTx');
                cy.contains('READ trans_id').should('be.visible');
                cy.contains('button', 'UPDATE').click();
                cy.wait('@apiUpdateTx');
                cy.contains('UPDATE trans_id').should('be.visible');
                cy.contains('button', 'Commit').click();
                cy.wait('@apiCommitTx');
                cy.contains('COMMIT').should('be.visible');
                
                cy.origin(NODE2, { args: { level } }, ({ level }) => {
                    cy.visit('concurrency')
                    // cy.visit(NODE2)
                    // cy.contains('a', 'Concurrency Demo').click();
                    cy.get('#txA-node').select('Node 2 (fragment)');
                    cy.get('#txA-iso').select(level);
                    cy.contains('button', 'Start Tx A').click();
                    cy.wait('@apiStartTx');
                    cy.contains('Started transaction').should('be.visible');
                    cy.contains('button', 'READ').click();
                    cy.wait('@apiReadTx');
                    cy.contains('READ trans_id').should('be.visible');
                    cy.contains('button', 'UPDATE').click();
                    cy.wait('@apiUpdateTx');
                    cy.contains('UPDATE trans_id').should('be.visible');
                    cy.contains('button', 'Commit').click();
                    cy.wait('@apiCommitTx');
                    cy.contains('COMMIT').should('be.visible');
                });
                
                // if(level == "READ UNCOMMITTED") {
                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');

                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'UPDATE').click();
                //     //     cy.wait('@apiUpdateTx');
                //     //     cy.contains('UPDATE trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });
                // } else {
                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');

                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'UPDATE').click();
                //     //     cy.wait('@apiUpdateTx');
                //     //     cy.contains('UPDATE trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });

                //     // cy.visit(NODE1 + 'concurrency')
                //     // // cy.visit(NODE1)
                //     // // cy.contains('a', 'Concurrency Demo').click();
                //     // cy.get('#txA-node').select('Node 1 (central)');
                //     // cy.get('#txA-iso').select(`${level}`);
                //     // cy.contains('button', 'Start Tx A').click();
                //     // cy.wait('@apiStartTx');
                //     // cy.contains('Started transaction').should('be.visible');
                //     // cy.contains('button', 'READ').click();
                //     // cy.wait('@apiReadTx');
                //     // cy.contains('READ trans_id').should('be.visible');
                //     // cy.contains('button', 'UPDATE').click();
                //     // cy.wait('@apiUpdateTx');
                //     // cy.contains('UPDATE trans_id').should('be.visible');
                //     // cy.contains('button', 'Commit').click();
                //     // cy.wait('@apiCommitTx');
                //     // cy.contains('COMMIT').should('be.visible');
                    
                //     // cy.origin(NODE2, { args: { level } }, ({ level }) => {
                //     //     cy.visit('concurrency')
                //     //     // cy.visit(NODE2)
                //     //     // cy.contains('a', 'Concurrency Demo').click();
                //     //     cy.get('#txA-node').select('Node 2 (fragment)');
                //     //     cy.get('#txA-iso').select(level);
                //     //     cy.contains('button', 'Start Tx A').click();
                //     //     cy.wait('@apiStartTx');
                //     //     cy.contains('Started transaction').should('be.visible');
                //     //     cy.contains('button', 'READ').click();
                //     //     cy.wait('@apiReadTx');
                //     //     cy.contains('READ trans_id').should('be.visible');
                //     //     cy.contains('button', 'UPDATE').click();
                //     //     cy.wait('@apiUpdateTx');
                //     //     cy.contains('UPDATE trans_id').should('be.visible');
                //     //     cy.contains('button', 'Commit').click();
                //     //     cy.wait('@apiCommitTx');
                //     //     cy.contains('COMMIT').should('be.visible');
                //     // });
                // }
            });
        });
    });
});