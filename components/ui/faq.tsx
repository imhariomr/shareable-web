"use client"

import Script from "next/script"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQ_ITEMS = [
  {
    question: "Is Sendvia free to use?",
    answer: "Yes, Sendvia is completely free for file sharing between devices.",
  },
  {
    question: "Does Sendvia store uploaded files?",
    answer:
      "No. Files are transferred directly between devices using peer-to-peer encrypted connections.",
  },
  {
    question: "Is there a file size limit?",
    answer:
      "No, Sendvia supports sharing large files without traditional upload limits.",
  },
]

export default function FAQ() {
  return (
    <section
      id="faq"
      className="w-full py-20 bg-gray-50 dark:bg-slate-900"
    >
      <Script
        id="sendvia-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />

      <div className="mx-auto max-w-4xl px-6">

        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Frequently Asked Questions
        </h2>

        <Accordion
          type="single"
          collapsible
          className="mt-10 w-full space-y-4"
        >
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.question}
              value={`item-${i}`}
              className="rounded-xl border border-gray-200 bg-white px-6 dark:bg-slate-950 dark:border-slate-800"
            >
              <AccordionTrigger className="text-left text-lg font-medium">
                {item.question}
              </AccordionTrigger>

              <AccordionContent className="text-gray-600 dark:text-gray-300 leading-7">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
