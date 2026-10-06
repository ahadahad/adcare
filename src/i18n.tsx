import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'bn';

const en = {
  language: { label: 'Language', english: 'English', bangla: 'Bangla' },
  nav: {
    tools: 'Tools', photo: 'Photo Studio', photoDetail: 'Passport & ID photos', a4: 'A4 Print', a4Detail: 'Document preparation', nid: 'NID / ID Print', nidDetail: 'Card layouts & export',
    help: 'Help & FAQ', about: 'About', start: 'Start creating', openTool: 'Open tool', back: 'Back to tools', switchTools: 'Switch tools', explore: 'Explore tools', home: 'Home',
  },
  stage: { loading: 'Loading', prepare: 'Preparing your workspace. Processing tools load only when you open them.', failed: 'We couldn’t open this tool.', other: 'Your other workspaces are still available.', retry: 'Try again' },
  meta: {
    home: 'Professional Photo & Document Tools', homeDescription: 'Edit photos, prepare A4 documents, create passport photos and make print-ready NID and ID card layouts.',
    photo: 'Photo Studio — Passport & ID Photos', photoDescription: 'Prepare passport and ID photos with crop, background, enhancement and print layout tools.',
    a4: 'A4 Print — Document Preparation', a4Description: 'Detect, crop and prepare document photos for A4 print and PDF export.',
    nid: 'NID & ID Print — Print-Ready ID Cards', nidDescription: 'Prepare front and back NID and ID cards with crop, OCR, adjustments and print exports.',
    about: 'About', aboutDescription: 'Learn about the photo and document tools and how file processing works.',
    help: 'Help & FAQ', helpDescription: 'Find help for uploads, cropping, photo formats, exports and privacy.',
    notFound: 'Page not found', notFoundDescription: 'The requested page could not be found.',
  },
  home: {
    kicker: 'Professional Photo & Document Tools',
    title: 'Everything you need to prepare photos and documents', accent: 'for print.',
    description: 'Edit photos, create passport-size photos, prepare A4 documents, and build print-ready NID and ID card layouts — directly in your browser.',
    start: 'Start creating', explore: 'Explore tools', browserNote: 'Many operations run locally in your browser',
    ribbonPrefix: 'One place for', ribbonPhoto: 'photo studio workflows', ribbonDocument: 'document preparation', ribbonLayouts: 'print-ready layouts',
    previewDescription: 'Illustrative preview of the three photo and document workspaces',
    preview: {
      kicker: 'A closer look', title: 'Product workspace preview', passport: 'Passport photo', background: 'Background', adjustments: 'Adjustments', export: 'Export', ready: 'Ready to print',
      documentTools: 'Document tools', autoDetect: 'Auto detect', adjustCrop: 'Adjust crop', printLayout: 'Print layout', exportPdf: 'Export PDF', nid: 'NID / ID Print', frontBack: 'Front & back layout', front: 'FRONT', back: 'BACK', designed: 'Designed for your workflow', local: 'Many image operations run in your browser', workspaces: 'Three focused workspaces', upload: 'Upload · prepare · print',
    },
    workspace: { kicker: 'A workspace for every task', title: 'Three focused tools.', accent: 'One familiar place.', intro: 'Pick the workflow that fits. Your editor opens with the tools and controls built for that job.' },
    tools: [
      { title: 'Photo Studio', description: 'Prepare passport and ID photos with crop, background, enhancement and print layout tools.', features: ['Passport formats', 'Face detection', 'Background tools', 'Image enhancement', '300 DPI print', 'PDF export'], link: 'Open Photo Studio' },
      { title: 'A4 Document Print', description: 'Turn document photos into clean, print-ready pages with detection and perspective correction.', features: ['Document detection', 'Perspective correction', 'Smart crop', 'Image adjustments', 'A4 layouts', 'PDF export'], link: 'Open A4 Print' },
      { title: 'NID & ID Card Print', description: 'Prepare front and back ID cards for printing with crop, adjustment, OCR and export tools.', features: ['Front / back support', 'OCR', 'Crop editor', 'Image adjustment', 'Print layouts', 'PDF export'], link: 'Open NID Print' },
    ],
    flow: { kicker: 'A simple workflow', title: 'From image to', accent: 'print.', steps: [
      { title: 'Choose a tool', description: 'Open the photo, A4 document or ID card workspace.' },
      { title: 'Upload and prepare', description: 'Use the editor to crop, adjust and arrange your image.' },
      { title: 'Export or print', description: 'Download a file or set up a print-ready page.' },
    ] },
    privacy: { kicker: 'A thoughtful default', title: 'Your files stay in', accent: 'your workflow.', description: 'Many image-processing operations run directly in your browser, reducing the need to upload sensitive documents to a server. Optional AI or external detection services may send the image you choose to share to their configured provider.', link: 'Read our approach' },
    featureSection: { kicker: 'Made for practical work', title: 'Useful tools, without', accent: 'the busywork.', description: 'The editors bring together the crop, image, print and export controls already present in each workflow.' },
    features: [
      { icon: 'clock', title: 'Fast processing', description: 'Browser-side image operations keep common editing steps close at hand.' },
      { icon: 'printer', title: 'Print-ready output', description: 'Set up page layouts and export documents for print.' },
      { icon: 'wand', title: 'Professional image tools', description: 'Crop, adjust and enhance images using the original editor engines.' },
      { icon: 'scan', title: 'Document detection', description: 'Detect document edges and correct perspective in supported workflows.' },
      { icon: 'globe', title: 'Passport standards', description: 'Choose from the photo standards available in Photo Studio.' },
      { icon: 'layers', title: 'Multiple export formats', description: 'Download the formats supported by each editor, including PDF and image files.' },
    ],
    useCases: { kicker: 'Use it for', title: 'Everyday photo', accent: '& document tasks.', items: ['Passport photos', 'Visa photos', 'NID printing', 'ID card printing', 'A4 document preparation', 'Photo studio workflows', 'Office document preparation'] },
    final: { kicker: 'Ready when you are', title: 'Ready to prepare your next photo or document?', description: 'Choose a workspace and pick up right where your task begins.', open: 'Open Photo Studio', explore: 'Explore all tools' },
  },
  about: {
    kicker: 'A little context', title: 'Practical tools for work', accent: 'that ends on paper.',
    lead: 'brings three purpose-built image and document editors into one consistent place: a Photo Studio, an A4 document tool, and an NID / ID card print workspace. Each editor keeps its original processing engine and workflow.',
    workspacesTitle: 'Three focused workspaces', workspaces: 'Prepare passport and ID photos, correct document perspective for A4 pages, or arrange front and back ID cards. Each tool opens only when selected, so its heavier models and image libraries do not slow the home page.',
    browserTitle: 'Browser-first processing', browser: 'Many operations run locally in your browser, including image adjustments, canvas processing, cropping and print preparation. The specific workflow and its optional services determine whether anything leaves the browser.',
    explore: 'Explore the tools',
    privacyTitle: 'Your files stay in your workflow.', privacy: 'Many image-processing operations run directly in your browser, reducing the need to upload sensitive documents to a server. Some optional functions can contact a configured AI, OCR or detection provider. Those requests may transmit the image you choose to process. Do not use optional external processing for material you cannot share with that provider.',
    previewNote: 'This preview does not have AI provider credentials configured. Its local processing tools remain available; credential-backed server features are not active in this preview.',
    termsTitle: 'Terms of use', terms: 'These tools prepare images and layouts; they do not certify that a photo, document or print meets an authority’s current requirements. Check the receiving authority’s instructions before submitting important documents, and review the result before printing.',
  },
  help: {
    kicker: 'Help & FAQ', title: 'A few useful answers', accent: 'before you get started.',
    intro: 'Choose a tool, work with your image, then export or print from its workspace. These notes cover the most common questions.',
    questions: [
      { question: 'Which tool should I use?', answer: 'Use Photo Studio for passport and ID photos; A4 Print for photographed documents that need edge detection, crop and page layout; and NID / ID Print when you need front/back card handling and print exports.' },
      { question: 'Do my images get uploaded?', answer: 'Many image operations happen in your browser. Some optional features call a configured external service, such as an AI assistant or an external detection provider, and may send the image used for that request. Review the provider before using those options with sensitive files.' },
      { question: 'What files can I use?', answer: 'The original editors accept common image formats such as JPEG and PNG; the ID tool also accepts WebP. Each editor shows its accepted file types in the upload area.' },
      { question: 'Can I save print-ready files?', answer: 'Yes. Export options depend on the tool and include PDF or image exports; the A4 and ID editors also provide print layouts. Use the controls inside the selected editor to choose a supported output.' },
      { question: 'Do passport dimensions meet every country’s rules?', answer: 'Photo Studio includes multiple country formats and standards. Requirements can change and can differ by purpose, so confirm dimensions, background and framing with the issuing authority before submitting.' },
      { question: 'Why is a tool taking time to open?', answer: 'Each workspace loads its own editing code only when opened. Some operations may also need to initialize a browser-side model or vision library the first time you use them. Keep the tab open while that operation finishes.' },
      { question: 'Can I switch tools without losing my work?', answer: 'The shell keeps each tool’s editing state separate. Switching workspaces closes the current editor, so export or save your work before leaving it.' },
    ],
    contactLead: 'Need more guidance? Visit the', contactAbout: 'About page', contactMiddle: 'for privacy and usage notes, or open the', contactTool: 'Photo Studio', contactEnd: 'to begin.',
  },
  notFound: { title: 'We couldn’t find that page.', description: 'The address may have changed, but your tools are still close by. Head back to the product and choose a workspace.', back: 'Back to tools' },
  footer: { tagline: 'Photo & document tools, ready for print.', description: 'Prepare a photo, document or ID card for the page it belongs on.', tools: 'Tools', resources: 'Resources', information: 'Information', about: 'About', privacy: 'Privacy approach', terms: 'Terms of use', rights: 'All rights reserved.' },
};

const bn: typeof en = {
  language: { label: 'ভাষা', english: 'ইংরেজি', bangla: 'বাংলা' },
  nav: {
    tools: 'টুলস', photo: 'ফটো স্টুডিও', photoDetail: 'পাসপোর্ট ও আইডি ছবি', a4: 'এ৪ প্রিন্ট', a4Detail: 'ডকুমেন্ট প্রস্তুত', nid: 'এনআইডি / আইডি প্রিন্ট', nidDetail: 'কার্ড লেআউট ও এক্সপোর্ট',
    help: 'সহায়তা ও সাধারণ প্রশ্ন', about: 'পরিচিতি', start: 'কাজ শুরু করুন', openTool: 'টুল খুলুন', back: 'টুলে ফিরে যান', switchTools: 'টুল বদলান', explore: 'টুলগুলো দেখুন', home: 'হোম',
  },
  stage: { loading: 'লোড হচ্ছে', prepare: 'আপনার কাজের পরিসর প্রস্তুত হচ্ছে। এডিটিং টুলগুলো খুললেই লোড হবে।', failed: 'এই টুলটি খোলা যায়নি।', other: 'আপনার অন্য কাজের পরিসরগুলো এখনো ব্যবহার করতে পারবেন।', retry: 'আবার চেষ্টা করুন' },
  meta: {
    home: 'ছবি ও ডকুমেন্ট প্রিন্টের টুল', homeDescription: 'ছবি সম্পাদনা করুন, এ৪ ডকুমেন্ট প্রস্তুত করুন, পাসপোর্ট সাইজের ছবি বানান এবং এনআইডি ও আইডি কার্ড প্রিন্টের জন্য সাজান।',
    photo: 'ফটো স্টুডিও — পাসপোর্ট ও আইডি ছবি', photoDescription: 'ক্রপ, ব্যাকগ্রাউন্ড, ছবি উন্নতকরণ ও প্রিন্ট লেআউটের মাধ্যমে পাসপোর্ট ও আইডি ছবি প্রস্তুত করুন।',
    a4: 'এ৪ প্রিন্ট — ডকুমেন্ট প্রস্তুত', a4Description: 'ডকুমেন্টের ছবি শনাক্ত ও ক্রপ করে এ৪ প্রিন্ট এবং পিডিএফের জন্য প্রস্তুত করুন।',
    nid: 'এনআইডি ও আইডি প্রিন্ট — প্রিন্টের জন্য প্রস্তুত কার্ড', nidDescription: 'ক্রপ, ওসিআর, সমন্বয় ও প্রিন্ট এক্সপোর্টসহ এনআইডি এবং আইডি কার্ডের সামনে-পেছনের অংশ প্রস্তুত করুন।',
    about: 'পরিচিতি', aboutDescription: 'ছবি ও ডকুমেন্ট টুল এবং ফাইল প্রক্রিয়াকরণ সম্পর্কে জানুন।',
    help: 'সহায়তা ও সাধারণ প্রশ্ন', helpDescription: 'আপলোড, ক্রপ, ছবির মাপ, এক্সপোর্ট ও গোপনীয়তা সম্পর্কে সহায়তা নিন।',
    notFound: 'পাতাটি পাওয়া যায়নি', notFoundDescription: 'চাওয়া পাতাটি খুঁজে পাওয়া যায়নি।',
  },
  home: {
    kicker: 'ছবি ও ডকুমেন্ট প্রস্তুতের টুল',
    title: 'ছবি ও ডকুমেন্ট সহজেই প্রস্তুত করুন', accent: 'প্রিন্টের জন্য।',
    description: 'ব্রাউজারেই ছবি সম্পাদনা করুন, পাসপোর্ট সাইজের ছবি তৈরি করুন, এ৪ ডকুমেন্ট প্রস্তুত করুন এবং এনআইডি ও আইডি কার্ড প্রিন্টের জন্য সাজান।',
    start: 'কাজ শুরু করুন', explore: 'টুলগুলো দেখুন', browserNote: 'অনেক কাজ সরাসরি আপনার ব্রাউজারেই হয়',
    ribbonPrefix: 'এক জায়গায়', ribbonPhoto: 'ছবি সম্পাদনা', ribbonDocument: 'ডকুমেন্ট প্রস্তুতি', ribbonLayouts: 'প্রিন্ট লেআউট',
    previewDescription: 'ছবি ও ডকুমেন্টের তিনটি কাজের পরিসরের নমুনা',
    preview: {
      kicker: 'এক নজরে', title: 'কাজের পরিসরের নমুনা', passport: 'পাসপোর্ট ছবি', background: 'ব্যাকগ্রাউন্ড', adjustments: 'সমন্বয়', export: 'এক্সপোর্ট', ready: 'প্রিন্টের জন্য প্রস্তুত',
      documentTools: 'ডকুমেন্ট টুল', autoDetect: 'স্বয়ংক্রিয় শনাক্ত', adjustCrop: 'ক্রপ ঠিক করুন', printLayout: 'প্রিন্ট লেআউট', exportPdf: 'পিডিএফ এক্সপোর্ট', nid: 'এনআইডি / আইডি প্রিন্ট', frontBack: 'সামনে ও পেছনের লেআউট', front: 'সামনে', back: 'পেছনে', designed: 'আপনার কাজের জন্য তৈরি', local: 'অনেক ছবি-সংক্রান্ত কাজ ব্রাউজারে হয়', workspaces: 'তিনটি নির্দিষ্ট কাজের পরিসর', upload: 'আপলোড · প্রস্তুত · প্রিন্ট',
    },
    workspace: { kicker: 'প্রতিটি কাজের জন্য আলাদা পরিসর', title: 'তিনটি দরকারি টুল।', accent: 'একটি পরিচিত জায়গায়।', intro: 'আপনার কাজের ধরন বেছে নিন। সেই কাজের দরকারি টুল ও নিয়ন্ত্রণসহ এডিটর খুলবে।' },
    tools: [
      { title: 'ফটো স্টুডিও', description: 'ক্রপ, ব্যাকগ্রাউন্ড, ছবি উন্নতকরণ ও প্রিন্ট লেআউট দিয়ে পাসপোর্ট ও আইডি ছবি প্রস্তুত করুন।', features: ['পাসপোর্ট ছবির মাপ', 'মুখ শনাক্তকরণ', 'ব্যাকগ্রাউন্ড টুল', 'ছবি উন্নতকরণ', '৩০০ ডিপিআই প্রিন্ট', 'পিডিএফ এক্সপোর্ট'], link: 'ফটো স্টুডিও খুলুন' },
      { title: 'এ৪ ডকুমেন্ট প্রিন্ট', description: 'ডকুমেন্টের ছবি শনাক্ত ও দৃষ্টিকোণ ঠিক করে পরিষ্কার, প্রিন্টের উপযোগী পাতায় সাজান।', features: ['ডকুমেন্ট শনাক্ত', 'দৃষ্টিকোণ সংশোধন', 'স্মার্ট ক্রপ', 'ছবি সমন্বয়', 'এ৪ লেআউট', 'পিডিএফ এক্সপোর্ট'], link: 'এ৪ প্রিন্ট খুলুন' },
      { title: 'এনআইডি ও আইডি কার্ড প্রিন্ট', description: 'ক্রপ, সমন্বয়, ওসিআর ও এক্সপোর্ট টুল দিয়ে আইডি কার্ডের সামনে-পেছনের অংশ প্রিন্টের জন্য সাজান।', features: ['সামনে-পেছনে সাজানো', 'ওসিআর', 'ক্রপ এডিটর', 'ছবি সমন্বয়', 'প্রিন্ট লেআউট', 'পিডিএফ এক্সপোর্ট'], link: 'এনআইডি প্রিন্ট খুলুন' },
    ],
    flow: { kicker: 'সহজ কাজের ধাপ', title: 'ছবি থেকে', accent: 'প্রিন্টে।', steps: [
      { title: 'টুল বেছে নিন', description: 'ছবি, এ৪ ডকুমেন্ট বা আইডি কার্ডের কাজের পরিসর খুলুন।' },
      { title: 'আপলোড ও প্রস্তুত করুন', description: 'এডিটরে ছবি ক্রপ, সমন্বয় ও সাজিয়ে নিন।' },
      { title: 'এক্সপোর্ট বা প্রিন্ট', description: 'ফাইল ডাউনলোড করুন অথবা প্রিন্টের উপযোগী পাতা তৈরি করুন।' },
    ] },
    privacy: { kicker: 'গোপনীয়তা মাথায় রেখে', title: 'ফাইল থাকে আপনার', accent: 'কাজের পরিসরে।', description: 'ছবি প্রক্রিয়াকরণের অনেক কাজ সরাসরি ব্রাউজারে হয়, তাই সংবেদনশীল ডকুমেন্ট সার্ভারে পাঠানোর প্রয়োজন কমে। ঐচ্ছিক এআই বা বাহ্যিক শনাক্তকরণ সেবা ব্যবহার করলে আপনার বেছে নেওয়া ছবি সংশ্লিষ্ট সেবাদাতার কাছে যেতে পারে।', link: 'আমাদের পদ্ধতি জানুন' },
    featureSection: { kicker: 'দৈনন্দিন কাজের জন্য', title: 'দরকারি টুল, কম', accent: 'ঝামেলায়।', description: 'প্রতিটি এডিটরে থাকা ক্রপ, ছবি, প্রিন্ট ও এক্সপোর্টের নিয়ন্ত্রণগুলো একসঙ্গে সাজানো হয়েছে।' },
    features: [
      { icon: 'clock', title: 'দ্রুত প্রক্রিয়াকরণ', description: 'ব্রাউজারে ছবি সম্পাদনার সাধারণ ধাপগুলো হাতের কাছেই থাকে।' },
      { icon: 'printer', title: 'প্রিন্টের উপযোগী ফল', description: 'পাতার লেআউট সাজিয়ে ডকুমেন্ট প্রিন্টের জন্য এক্সপোর্ট করুন।' },
      { icon: 'wand', title: 'ছবি সম্পাদনার টুল', description: 'মূল এডিটর দিয়েই ছবি ক্রপ, সমন্বয় ও উন্নত করুন।' },
      { icon: 'scan', title: 'ডকুমেন্ট শনাক্তকরণ', description: 'সমর্থিত টুলে ডকুমেন্টের কিনারা শনাক্ত ও দৃষ্টিকোণ সংশোধন করুন।' },
      { icon: 'globe', title: 'পাসপোর্ট ছবির মাপ', description: 'ফটো স্টুডিওতে থাকা বিভিন্ন ছবির মাপ থেকে বেছে নিন।' },
      { icon: 'layers', title: 'একাধিক এক্সপোর্ট', description: 'পিডিএফ ও ছবি-সহ প্রতিটি এডিটরের সমর্থিত ফরম্যাট ডাউনলোড করুন।' },
    ],
    useCases: { kicker: 'যে কাজে ব্যবহার করুন', title: 'প্রতিদিনের ছবি', accent: 'ও ডকুমেন্টের কাজ।', items: ['পাসপোর্ট ছবি', 'ভিসার ছবি', 'এনআইডি প্রিন্ট', 'আইডি কার্ড প্রিন্ট', 'এ৪ ডকুমেন্ট প্রস্তুতি', 'ছবি সম্পাদনা', 'অফিসের ডকুমেন্ট প্রস্তুতি'] },
    final: { kicker: 'আপনি প্রস্তুত হলেই', title: 'পরের ছবি বা ডকুমেন্টটি প্রস্তুত করবেন?', description: 'কাজের পরিসর বেছে নিয়ে সরাসরি প্রয়োজনীয় ধাপে যান।', open: 'ফটো স্টুডিও খুলুন', explore: 'সব টুল দেখুন' },
  },
  about: {
    kicker: 'কিছু প্রাসঙ্গিক কথা', title: 'ব্যবহারিক টুল, যার কাজ', accent: 'শেষ হয় কাগজে।',
    lead: 'ছবি ও ডকুমেন্ট সম্পাদনার তিনটি বিশেষায়িত টুলকে এক জায়গায় এনেছে: ফটো স্টুডিও, এ৪ ডকুমেন্ট টুল এবং এনআইডি / আইডি কার্ড প্রিন্টের পরিসর। প্রতিটি এডিটর তার মূল প্রক্রিয়াকরণ পদ্ধতি ও কাজের ধারা অক্ষুণ্ণ রাখে।',
    workspacesTitle: 'তিনটি নির্দিষ্ট কাজের পরিসর', workspaces: 'পাসপোর্ট ও আইডি ছবি প্রস্তুত করুন, এ৪ পাতার জন্য ডকুমেন্টের দৃষ্টিকোণ ঠিক করুন, অথবা আইডি কার্ডের সামনে-পেছনের অংশ সাজান। শুধু নির্বাচিত টুলই খোলে, তাই ভারী মডেল ও ছবি লাইব্রেরি হোম পেজকে ধীর করে না।',
    browserTitle: 'ব্রাউজারেই প্রক্রিয়াকরণ', browser: 'ছবি সমন্বয়, ক্যানভাস প্রক্রিয়াকরণ, ক্রপ ও প্রিন্ট প্রস্তুতিসহ অনেক কাজ ব্রাউজারেই হয়। কোনো তথ্য ব্রাউজারের বাইরে যাবে কি না, তা নির্দিষ্ট কাজ এবং ঐচ্ছিক সেবার ওপর নির্ভর করে।',
    explore: 'টুলগুলো দেখুন',
    privacyTitle: 'ফাইল থাকে আপনার কাজের পরিসরে।', privacy: 'ছবি প্রক্রিয়াকরণের অনেক কাজ সরাসরি ব্রাউজারে হয়, তাই সংবেদনশীল ডকুমেন্ট সার্ভারে পাঠানোর প্রয়োজন কমে। কিছু ঐচ্ছিক ফিচার কনফিগার করা এআই, ওসিআর বা শনাক্তকরণ সেবার সঙ্গে যোগাযোগ করতে পারে। এসব অনুরোধে আপনার বেছে নেওয়া ছবি পাঠানো হতে পারে। যে সেবাদাতার সঙ্গে ভাগ করতে পারবেন না, তার জন্য ঐচ্ছিক বাহ্যিক প্রক্রিয়াকরণ ব্যবহার করবেন না।',
    previewNote: 'এই প্রিভিউতে এআই সেবার কোনো পরিচয়পত্র কনফিগার করা নেই। ব্রাউজারের স্থানীয় টুলগুলো ব্যবহার করা যায়; পরিচয়পত্র-নির্ভর সার্ভার ফিচার এখানে চালু নেই।',
    termsTitle: 'ব্যবহারের শর্ত', terms: 'এই টুলগুলো ছবি ও লেআউট প্রস্তুত করে; কোনো ছবি, ডকুমেন্ট বা প্রিন্ট বর্তমান কর্তৃপক্ষের নিয়ম পূরণ করে—এমন নিশ্চয়তা দেয় না। গুরুত্বপূর্ণ ডকুমেন্ট জমা দেওয়ার আগে সংশ্লিষ্ট কর্তৃপক্ষের নির্দেশনা দেখুন এবং প্রিন্টের আগে ফল যাচাই করুন।',
  },
  help: {
    kicker: 'সহায়তা ও সাধারণ প্রশ্ন', title: 'শুরু করার আগে', accent: 'কিছু দরকারি উত্তর।',
    intro: 'একটি টুল বেছে নিয়ে ছবি প্রস্তুত করুন, তারপর সেই কাজের পরিসর থেকেই এক্সপোর্ট বা প্রিন্ট করুন। এখানে সাধারণ কিছু প্রশ্নের উত্তর রয়েছে।',
    questions: [
      { question: 'কোন টুলটি ব্যবহার করব?', answer: 'পাসপোর্ট ও আইডি ছবির জন্য ফটো স্টুডিও ব্যবহার করুন; কিনারা শনাক্ত, ক্রপ ও পাতায় সাজানোর ডকুমেন্ট ছবির জন্য এ৪ প্রিন্ট; আর কার্ডের সামনে-পেছনের অংশ ও প্রিন্ট এক্সপোর্টের জন্য এনআইডি / আইডি প্রিন্ট বেছে নিন।' },
      { question: 'আমার ছবি কি আপলোড হয়?', answer: 'ছবি-সংক্রান্ত অনেক কাজ আপনার ব্রাউজারেই হয়। কিছু ঐচ্ছিক ফিচার—যেমন এআই সহকারী বা বাহ্যিক শনাক্তকরণ—কনফিগার করা সেবায় ছবি পাঠাতে পারে। সংবেদনশীল ফাইলের ক্ষেত্রে এসব বিকল্প ব্যবহারের আগে সেবাদাতার নীতি দেখে নিন।' },
      { question: 'কোন ফাইল ব্যবহার করতে পারি?', answer: 'মূল এডিটরগুলো সাধারণত JPEG ও PNG-এর মতো ছবি নেয়; আইডি টুলে WebP-ও চলে। আপলোড অংশে প্রতিটি এডিটরের সমর্থিত ফাইলের ধরন দেখানো হয়।' },
      { question: 'প্রিন্টের উপযোগী ফাইল সংরক্ষণ করতে পারি?', answer: 'হ্যাঁ। টুলভেদে পিডিএফ বা ছবির ফরম্যাটে এক্সপোর্ট করা যায়; এ৪ ও আইডি এডিটরে প্রিন্ট লেআউটও আছে। সমর্থিত আউটপুট বেছে নিতে নির্বাচিত এডিটরের নিয়ন্ত্রণগুলো ব্যবহার করুন।' },
      { question: 'পাসপোর্ট ছবির মাপ কি সব দেশের নিয়ম মেনে চলে?', answer: 'ফটো স্টুডিওতে একাধিক দেশ ও মানের ছবির মাপ রয়েছে। নিয়ম সময়ের সঙ্গে বদলাতে পারে এবং কাজভেদে ভিন্ন হতে পারে—জমা দেওয়ার আগে সংশ্লিষ্ট কর্তৃপক্ষের কাছ থেকে মাপ, ব্যাকগ্রাউন্ড ও ফ্রেমিং নিশ্চিত করুন।' },
      { question: 'কোনো টুল খুলতে সময় লাগছে কেন?', answer: 'প্রতিটি কাজের পরিসরের কোড শুধু সেটি খুললেই লোড হয়। কিছু কাজে প্রথমবার ব্রাউজারের মডেল বা ভিশন লাইব্রেরি চালু হতে পারে। কাজটি শেষ না হওয়া পর্যন্ত ট্যাব খোলা রাখুন।' },
      { question: 'কাজ না হারিয়ে টুল বদলাতে পারি?', answer: 'প্রতিটি টুলের সম্পাদনার অবস্থা আলাদা থাকে। অন্য টুলে গেলে বর্তমান এডিটর বন্ধ হয়, তাই বের হওয়ার আগে কাজ এক্সপোর্ট বা সংরক্ষণ করুন।' },
    ],
    contactLead: 'আরও সহায়তা দরকার? গোপনীয়তা ও ব্যবহারের তথ্যের জন্য', contactAbout: 'পরিচিতি পাতাটি দেখুন', contactMiddle: ', অথবা শুরু করতে', contactTool: 'ফটো স্টুডিও খুলুন', contactEnd: '।',
  },
  notFound: { title: 'পাতাটি খুঁজে পাওয়া যায়নি।', description: 'ঠিকানাটি বদলে যেতে পারে, তবে আপনার টুলগুলো কাছেই আছে। পণ্যের হোম পেজে ফিরে একটি কাজের পরিসর বেছে নিন।', back: 'টুলে ফিরে যান' },
  footer: { tagline: 'ছবি ও ডকুমেন্ট, প্রিন্টের জন্য প্রস্তুত।', description: 'ছবি, ডকুমেন্ট বা আইডি কার্ডকে তার প্রয়োজনীয় পাতার জন্য প্রস্তুত করুন।', tools: 'টুলস', resources: 'সহায়তা', information: 'তথ্য', about: 'পরিচিতি', privacy: 'গোপনীয়তা', terms: 'ব্যবহারের শর্ত', rights: 'সর্বস্বত্ব সংরক্ষিত।' },
};

export type Copy = typeof en;
const dictionaries: Record<Language, Copy> = { en, bn };
const storageKey = 'ahad-digital-care-language';

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; copy: Copy };
const LanguageContext = createContext<LanguageContextValue | null>(null);

function preferredLanguage(): Language {
  try { return window.localStorage.getItem(storageKey) === 'bn' ? 'bn' : 'en'; }
  catch { return 'en'; }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(preferredLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    try { window.localStorage.setItem(storageKey, language); } catch { /* Storage is optional; the active session still works. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, copy: dictionaries[language] }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
