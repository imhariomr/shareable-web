'use client'
import { createContext, useContext, useState } from "react";

export const UploadingFilesContext = createContext<any>(null);

export const UploadingFilesProvider = ({children}:any)=>{
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
    return(
        <UploadingFilesContext.Provider value={{ uploadingFiles, setUploadingFiles }}>
            {children}
        </UploadingFilesContext.Provider>        
    )
}

export const UseUploadingFiles = () =>{
    return useContext(UploadingFilesContext);
}