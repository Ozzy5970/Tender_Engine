async function test() {
    try {
        const resp = await fetch('https://hhkmbwlfbonsafrwkqnc.supabase.co/functions/v1/ingest-tender', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer sb_publishable_ZIJAs_2HwrnBhR6pPu-oDA_kvKRph9c',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tender_id: "123e4567-e89b-12d3-a456-426614174000",
                file_path: "test/path",
                file_name: "test_smoke.pdf"
            })
        });
        const data = await resp.text();
        console.log("Status:", resp.status);
        console.log("Body:", data);
    } catch (e) {
        console.error(e);
    }
}

test();
