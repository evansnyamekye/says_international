// import { sql } from '@vercel/postgres';

// export default async function handler(req, res) {

//     res.setHeader('Cache-Control', 'no-store');

//     if (req.method !== 'POST') {
//         return res.status(405).json({ error: 'Method not allowed' });
//     }

//     try {

//         const body = req.body;

//         console.log('Received:', body);

//         // Basic required validation
//         if (!body.student_name) {
//             return res.status(400).json({ error: 'Student name is required' });
//         }

//         if (!body.email) {
//             return res.status(400).json({ error: 'Email is required' });
//         }

//         // Insert into database
//         await sql`
//             INSERT INTO student_admissions (
//                 student_name,
//                 gender,
//                 religion,
//                 nationality,
//                 parent_name,
//                 email,
//                 mobile_phone,
//                 home_phone,
//                 grade,
//                 previously_applied,
//                 previous_year,
//                 vision,
//                 hearing,
//                 speech,
//                 development_delays,
//                 allergies,
//                 communicable_disease,
//                 emergency_care,
//                 heart_condition,
//                 medical_notes,
//                 relative_name,
//                 relative_tel,
//                 preferred_hospital,
//                 insurance,
//                 condition_details,
//                 ip_address,
//                 user_agent
//             )
//             VALUES (
//                 ${body.student_name},
//                 ${body.gender},
//                 ${body.religion},
//                 ${body.nationality},
//                 ${body.parent_name},
//                 ${body.email},
//                 ${body.mobile_phone},
//                 ${body.home_phone},
//                 ${body.grade},
//                 ${body.previously_applied},
//                 ${body.previous_year},
//                 ${body.vision},
//                 ${body.hearing},
//                 ${body.speech},
//                 ${body.development_delays},
//                 ${body.allergies},
//                 ${body.communicable_disease},
//                 ${body.emergency_care},
//                 ${body.heart_condition},
//                 ${body.medical_notes},
//                 ${body.relative_name},
//                 ${body.relative_tel},
//                 ${body.preferred_hospital},
//                 ${body.insurance},
//                 ${body.condition_details},
//                 ${body.ip_address || null},
//                 ${body.user_agent || null}
//             );
//         `;

//         return res.status(201).json({
//             success: true,
//             message: 'Application saved successfully'
//         });

//     } catch (error) {

//         console.error('DB Error:', error);

//         return res.status(500).json({
//             error: 'Failed to save application'
//         });
//     }
// }

export default async function handler(req, res) {

    return res.status(200).json({
        success: true,
        message: 'Backend working'
    });
}