Promise.all([
    axios.post("http://localhost:3001/trans/update", { trans_id: 100, amount: 777, isolation: "SERIALIZABLE" }),
    axios.post("http://localhost:3003/trans/update", { trans_id: 100, amount: 888, isolation: "SERIALIZABLE" })
]);
