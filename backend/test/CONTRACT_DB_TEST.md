# Contract MongoDB integration test

This stack uses its own MongoDB process, port 27028 and `*_test` databases. It does not read or change `backend/.env`.

From `backend` on Windows PowerShell:

```powershell
docker compose -f test/contract-mongo.compose.yml -p vibehue-contract-test up -d
docker compose -f test/contract-mongo.compose.yml -p vibehue-contract-test exec contract-mongo mongosh --quiet --eval 'rs.initiate({_id:"rsContractTest",members:[{_id:0,host:"localhost:27017"}]})'
$env:CONTRACT_TEST_MONGODB_URI='mongodb://127.0.0.1:27028/contract_phase45_test?replicaSet=rsContractTest&directConnection=true'
$env:CONTRACT_TEST_DB_NAME='contract_phase45_test'
npx jest --runInBand modules/contracts/contract-index.integration.spec.ts modules/contracts/contract-runtime.integration.spec.ts
```

Wait for the replica set to elect a primary before running Jest. To inspect status:

```powershell
docker compose -f test/contract-mongo.compose.yml -p vibehue-contract-test exec contract-mongo mongosh --quiet --eval 'rs.status().myState'
```

The test gate accepts only `localhost` or `127.0.0.1` on port `27028`, with the URI database equal to `CONTRACT_TEST_DB_NAME` and ending in `_test`. Tests create uniquely named scratch databases and remove them in `finally`. The migration `--apply` command is run only with its explicit test database guard and dry-run fingerprint.

When Docker Desktop is unavailable, start it and wait for `docker info` to succeed. The tests must remain skipped until a separate replica set is ready. Never point these variables at the application database.
