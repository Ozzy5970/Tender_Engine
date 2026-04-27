import os

api_path = "frontend/src/services/api.ts"
with open(api_path, 'r') as f:
    content = f.read()

update_method = """
    async updateManualTender(id: string, data: ManualTenderData, isDraft: boolean = false) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: "User not authenticated", status: 401 }

        const { data: tender, error: tenderError } = await supabase
            .from('tenders')
            .update({
                title: data.title,
                client_name: data.client_name,
                reference_number: data.tender_number || null,
                closing_date: data.closing_date ? new Date(data.closing_date).toISOString() : null,
                status: 'DRAFT'
            })
            .eq('id', id)
            .select()
            .single()

        if (tenderError || !tender) return { data: null, error: "Tender update failed: " + tenderError?.message, status: 400 }

        await supabase.from('compliance_requirements').delete().eq('tender_id', tender.id)

        const requirements: any[] = []

        if (data.requirements.cidb_grade) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'CIDB',
                description: `Minimum CIDB Grading of ${data.requirements.cidb_grade}${data.requirements.cidb_class}`,
                target_value: { grade: data.requirements.cidb_grade, class: data.requirements.cidb_class },
                is_killer: true
            })
        }

        if (data.requirements.min_bbbee_level) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'BBBEE',
                description: `Minimum B-BBEE Level ${data.requirements.min_bbbee_level}`,
                target_value: { min_level: parseInt(data.requirements.min_bbbee_level) },
                is_killer: false
            })
        }

        if (data.requirements.mandatory_docs && data.requirements.mandatory_docs.length > 0) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'MANDATORY_DOC',
                description: `Standard Administrative Compliance`,
                target_value: { docs: data.requirements.mandatory_docs },
                is_killer: true
            })
        }

        if (data.tender_description) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'TENDER_DESCRIPTION',
                description: 'Tender Description',
                target_value: { text: data.tender_description },
                is_killer: false
            })
        }

        if (data.additional_returnables) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'ADDITIONAL_RETURNABLE',
                description: 'Additional Mandatory Returnables',
                target_value: { text: data.additional_returnables },
                is_killer: true
            })
        }

        if (data.preference_points) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'PREFERENCE_POINTS',
                description: `Preference points system`,
                target_value: { system: data.preference_points },
                is_killer: false
            })
        }

        if (data.compulsory_briefing) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'COMPULSORY_BRIEFING',
                description: `Compulsory Briefing Session Required`,
                target_value: { required: true },
                is_killer: true
            })
        }

        if (data.notes) {
            requirements.push({
                tender_id: tender.id,
                rule_category: 'SPECIAL_CONDITIONS',
                description: data.notes,
                target_value: { text: data.notes },
                is_killer: false
            })
        }

        if (requirements.length > 0) {
            const { error: reqError } = await supabase
                .from('compliance_requirements')
                .insert(requirements)

            if (reqError) {
                return { data: tender, error: "Tender updated but requirement save failed: " + reqError.message, status: 206 }
            }
        }

        if (isDraft) {
            await supabase.from('tenders').update({ status: 'DRAFT', compliance_score: null, readiness: null }).eq('id', tender.id);
            return { data: { ...tender, status: 'DRAFT' }, error: null, status: 200 }
        }

        let finalScore: number | null = null;
        let readinessState: 'READY' | 'AMBER' | 'RED' | null = null;

        try {
            const { data: docs } = await CompanyService.getCompliance();
            const tenderForScoring = { ...tender, compliance_requirements: requirements };
            
            const result = calculateReadinessScore(tenderForScoring, docs || []);
            finalScore = result.score;
            readinessState = result.readiness;
        } catch (e) {
            console.error("Failed to calculate readiness score during tender update", e);
        }

        await supabase.from('tenders').update({ 
            status: 'DRAFT', 
            compliance_score: finalScore, 
            readiness: readinessState
        }).eq('id', tender.id)

        return { data: tender, error: null, status: 200 }
    },
"""

# Insert right after createManualTender finishes
marker = "return { data: tender, error: null, status: 201 }\n    }"
if marker in content:
    content = content.replace(marker, marker + "\n" + update_method)
    with open(api_path, 'w') as f:
        f.write(content)
    print("Injected updateManualTender successfully")
else:
    print("Could not find marker")
