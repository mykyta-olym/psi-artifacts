// src/pages/final-thesis/components/bc/BcArchivedDetail.jsx
import React from 'react';
import Button from '../../../../components/ui/Button';

export default function BcArchivedDetail() {
    const data = {
        identifier: '77765',
        title: 'Approaches to Identifying Professional Developers of Open-Source Software',
        subField: '—',
        type: 'Bachelor thesis',
        instructions:
            '1) Analyze work related to identifying professional developers of open-source software. 2) Propose methods to identify professional open-source developers. 3) Validate the methods on selected datasets. 4) Document the results.',
        literature:
            '[1] RAGHURAMAN, Adithya, et al. Does UML modeling associate with lower defect proneness? MSR 2019. [2] PEIFFER, Rolf-Helge. Mining software repositories, 2019. [3] CLAES, Maëlick, et al. ICPC 2016. [4] WYNEN, et al. MSR 2020. [5] GUERROUJ, Lally; BAYSAL, Olga. MSR 2016. [6] KOCHHAR, Pavneet Singh; THUNG, Ferdian; LO, David. IEEE 2015.',
        extraInfo:
            'In software engineering, there is a growing body of research focused on identifying professional developers. The goal is to improve replicability, compare baseline methods, and determine suitable combinations of signals for higher accuracy.',
        primaryLang: 'Slovak (SK)',
        secondaryLang: 'English (EN)',
        note: '—',
        workplace: 'Department of Computers and Informatics (KPI)',
        supervisor: 'Ing. Matúš Sulír, PhD.',
        opponent: 'Ing. Sergej Chodarev, PhD.',
        consultant: '—',
        written: '23.09.2024',
        assigned: '03.10.2024',
        submit: '—',
        group: 'Study program: INF_Bc_D_sk',
        keywords: 'Open-Source Software, Developer Classification, Machine Learning, Repository Mining',
        abstract:
            'This bachelor thesis explores ways to identify professional developers in open-source software using data collected from GitHub. Key indicators include commit frequency, temporal patterns, and email domains combined with Random Forest and LightGBM classifiers.',
        annotation:
            'The thesis compares existing approaches and proposes composite methods that combine multiple data sources for more reliable distinction between hobby contributors and professionals.',
        supReviewUrl: 'https://etd.portal.tuke.sk/#/file/hash/e4efa...demo',
        oppReviewUrl: 'https://etd.portal.tuke.sk/#/file/hash/180a1...demo',
        defenseBy: 'Ing. Sergej Chodarev, PhD.',
        originalityDate: 'May 27, 2025 05:42',
        originalityPct: '3.64 %',
        originalityProto: 'https://www.crzp.sk/protokol?id=97f03...demo',
        library: '—',
        apsDate: 'May 27, 2025',
        grades: [
            ['Bachelor Project', 'WS 2024/2025', 'Graded credit', '93%', 'Feb 11, 2025'],
            ['Bachelor Thesis', 'SS 2024/2025', 'Committee evaluation for state exam', '68%', 'Jun 18, 2025'],
            ['Bachelor Thesis', 'SS 2024/2025', "Opponent's review of thesis", '95%', 'Jun 9, 2025'],
            ['Bachelor Thesis', 'SS 2024/2025', 'State exam grade', '94%', 'Jun 8, 2025'],
        ],
    };

    const Row = ({ k, v }) => (
        <tr className="border-b border-border/60 align-top">
            <td className="w-56 px-3 py-2 text-xs md:text-sm text-muted-foreground">{k}</td>
            <td className="px-3 py-2 text-xs md:text-sm">{v}</td>
        </tr>
    );

    return (
        <div className="bg-card glass-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">My Final Thesis</h3>
                <div className="hidden sm:flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" iconName="FileText" disabled>
                        Thesis Analytical Sheet
                    </Button>
                    <Button type="button" size="sm" variant="outline" iconName="FileText" disabled>
                        Thesis Abstract
                    </Button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <tbody>
                    <Row k="Identifier" v={<span>{data.identifier}</span>} />
                    <Row k="Title" v={<span className="font-medium">{data.title}</span>} />
                    <Row k="Subtitle" v={data.subField} />
                    <Row k="Type" v={data.type} />
                    <Row k="Guidelines" v={data.instructions} />
                    <Row k="Literature" v={<div className="whitespace-pre-wrap">{data.literature}</div>} />
                    <Row k="Additional information" v={data.extraInfo} />
                    <Row k="Primary language" v={data.primaryLang} />
                    <Row k="Secondary language" v={data.secondaryLang} />
                    <Row k="Note" v={data.note} />
                    <Row k="Supervising workplace" v={data.workplace} />
                    <Row k="Supervisor" v={data.supervisor} />
                    <Row k="Opponent" v={data.opponent} />
                    <Row k="Consultant" v={data.consultant} />
                    <Row k="Date announced" v={data.written} />
                    <Row k="Date assigned" v={data.assigned} />
                    <Row k="Submission deadline" v={data.submit} />
                    <Row k="Restriction group no. 1" v={data.group} />
                    <Row k="Keywords" v={data.keywords} />
                    <Row k="Abstract" v={data.abstract} />
                    <Row k="Annotation" v={data.annotation} />
                    <Row
                        k="Supervisor’s review"
                        v={
                            <a className="text-primary underline" href={data.supReviewUrl} target="_blank" rel="noreferrer">
                                {data.supReviewUrl}
                            </a>
                        }
                    />
                    <Row
                        k="Opponent’s review"
                        v={
                            <a className="text-primary underline" href={data.oppReviewUrl} target="_blank" rel="noreferrer">
                                {data.oppReviewUrl}
                            </a>
                        }
                    />
                    <Row k="Defense conducted by" v={data.defenseBy} />
                    <Row k="Originality check date" v={data.originalityDate} />
                    <Row k="Originality score" v={data.originalityPct} />
                    <Row
                        k="Originality report"
                        v={
                            <a className="text-primary underline" href={data.originalityProto} target="_blank" rel="noreferrer">
                                {data.originalityProto}
                            </a>
                        }
                    />
                    <Row k="Library availability" v={data.library} />
                    </tbody>
                </table>
            </div>

            <div className="border-t border-border px-4 py-3 text-sm font-medium">Originality Check Result in APS Turnitin</div>
            <div className="px-4 pb-4 text-sm">
                <div className="text-muted-foreground">Originality check date: {data.apsDate}</div>
            </div>

            <div className="border-t border-border px-4 py-3 text-sm font-medium">Final Thesis Evaluation</div>
            <div className="overflow-x-auto pb-4">
                <table className="w-full text-sm min-w-[720px]">
                    <thead>
                    <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-3 text-muted-foreground border-b border-border">
                        <th className="w-10">#</th>
                        <th>Course</th>
                        <th>Semester</th>
                        <th>Assessment</th>
                        <th>Grade</th>
                        <th>Awarded on</th>
                        <th>Notes</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.grades.map((g, i) => (
                        <tr key={String(i)} className="[&>td]:py-2 [&>td]:px-3 border-b border-border/60">
                            <td>{i + 1}</td>
                            <td>{g[0]}</td>
                            <td>{g[1]}</td>
                            <td>{g[2]}</td>
                            <td className="font-medium">{g[3]}</td>
                            <td>{g[4]}</td>
                            <td></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}