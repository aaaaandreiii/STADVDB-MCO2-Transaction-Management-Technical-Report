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
    // STEP 4: FAILURE RECOVERY CASES
    describe("=== FAILURE RECOVERY TESTS ===", () => {
        // CASE 1: Node1 fails during replication
        it("Case 1: Node 1 fails during replication", () => {
            cy.log("Testing: Node1 down while Node2 writes.");

            cy.visit(NODE1 + 'admin/panel')
            cy.get('button[onclick="setNodeOnline(1, false)"]').click();

            cy.origin(NODE2, () => {
                cy.visit('concurrency')
                cy.get('#txA-node').select('Node 2 (fragment)');
                cy.get('#txA-iso').select('REPEATABLE READ');
                cy.contains('button', 'Start Tx A').click();
                cy.contains('Started transaction').should('be.visible');
                cy.contains('button', 'UPDATE').click();
                // cy.contains('UPDATE trans_id').should('be.visible');
                cy.contains('button', 'Commit').click();
                cy.contains('COMMIT').should('be.visible');
            });
        });

        // CASE 2: Node1 recovers after missing updates
        it("Case 2: Node1 recovers and gets missed writes", () => {
            cy.log("Testing: Node1 recovers from failure.");

            cy.visit(NODE1 + 'admin/panel')
            cy.get('button[onclick="setNodeOnline(1, true)"]').click();

            cy.visit(NODE1 + 'transactions/local')
            cy.get('#search').type('1{enter}');
            // Show logs to verify.
        });

        // CASE 3: Node2 fails during replication from Node1
        it("Case 3: Node2 fails during central-node replication", () => {
            cy.log("Testing: Node2 down while Node1 writes.");

            cy.visit(NODE2 + 'admin/panel')
            cy.get('button[onclick="setNodeOnline(2, false)"]').click();

            cy.origin(NODE1, () => {
                cy.visit('concurrency')
                cy.get('#txA-node').select('Node 1 (central)');
                cy.get('#txA-iso').select('REPEATABLE READ');
                cy.contains('button', 'Start Tx A').click();
                cy.contains('Started transaction').should('be.visible');
                cy.contains('button', 'UPDATE').click();
                // cy.contains('UPDATE trans_id').should('be.visible');
                cy.contains('button', 'Commit').click();
                cy.contains('COMMIT').should('be.visible');
            });
        });

        // CASE 4: Node3 misses writes and recovers later
        it("Case 4: Node2 recovers and receives missed writes", () => {
            cy.log("Testing: Node2 recovers from failure.");

            cy.visit(NODE2 + 'admin/panel')
            cy.get('button[onclick="setNodeOnline(2, true)"]').click();

            cy.visit(NODE2 + 'transactions/local')
            cy.get('#search').type('1{enter}');
            // Show logs to verify.
        });
    });
});