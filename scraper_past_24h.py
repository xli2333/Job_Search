import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import random
import re 
from datetime import datetime
import os

def scrape_jobs(progress_callback=None):
    # --- 1. 配置参数 ---
    search_url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    landing_url = "https://www.linkedin.com/jobs/search"
    detail_base_url = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{}"

    params = {
        "keywords": "Graduate",
        "location": "New York",
        "geoId": "105080838",
        "f_TPR": "r86400", # 过去24小时
        "start": 0
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    max_jobs = 50 
    
    def log_progress(current, total, message):
        print(f"[{current}/{total}] {message}")
        if progress_callback:
            progress_callback(current, total, message)

    # --- 获取职位总数并自动设置目标 ---
    log_progress(0, 0, "正在分析职位总数...")
    try:
        landing_params = params.copy()
        if 'start' in landing_params:
            del landing_params['start']
            
        resp_total = requests.get(landing_url, params=landing_params, headers=headers, timeout=10)
        soup_total = BeautifulSoup(resp_total.text, 'html.parser')
        
        count_elem = soup_total.find("span", class_="results-context-header__job-count")
        
        if count_elem:
            total_text = count_elem.text.strip()
            match = re.search(r'(\d[\d,]*)', total_text)
            
            if match:
                total_count = int(match.group(1).replace(',', ''))
                print(f"📊 LinkedIn 显示共有: 【{total_count}】 个职位")
                
                safety_limit = 300
                if safety_limit and total_count > safety_limit:
                    max_jobs = safety_limit
                    log_progress(0, max_jobs, f"职位过多，限制为 {max_jobs} 个")
                else:
                    max_jobs = total_count
                    log_progress(0, max_jobs, f"目标设置为 {max_jobs} 个")
            else:
                 log_progress(0, max_jobs, "无法提取数字，使用默认目标")
        else:
            log_progress(0, max_jobs, "未能提取总数，使用默认目标")
            
    except Exception as e:
        log_progress(0, max_jobs, f"获取总数失败: {e}")

    print("-" * 30)

    # --- 开始循环抓取 ---
    job_list = []
    log_progress(0, max_jobs, "开始抓取...")

    while len(job_list) < max_jobs:
        try:
            log_progress(len(job_list), max_jobs, f"请求列表页 (start={params['start']})...")
            response = requests.get(search_url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                log_progress(len(job_list), max_jobs, f"列表请求受限: {response.status_code}")
                break

            soup = BeautifulSoup(response.text, 'html.parser')
            jobs = soup.find_all("li")

            if not jobs:
                log_progress(len(job_list), max_jobs, "没有更多职位了")
                break

            print(f"   -> 本页获取到 {len(jobs)} 个职位...")

            for job in jobs:
                if len(job_list) >= max_jobs:
                    break
                
                try:
                    title = job.find("h3", class_="base-search-card__title").text.strip()
                    company = job.find("h4", class_="base-search-card__subtitle").text.strip()
                    location = job.find("span", class_="job-search-card__location").text.strip()
                    date = job.find("time").text.strip() if job.find("time") else "N/A"
                    link_tag = job.find("a", class_="base-card__full-link")
                    link = link_tag['href'].split('?')[0] if link_tag else "N/A"

                    base_card_div = job.find("div", class_="base-card")
                    job_id = ""
                    if base_card_div and 'data-entity-urn' in base_card_div.attrs:
                        urn = base_card_div['data-entity-urn']
                        job_id = urn.split(":")[-1]
                    
                    description = "N/A"
                    if job_id:
                        log_progress(len(job_list), max_jobs, f"正在获取详情: {title[:15]}...")
                        target_api = detail_base_url.format(job_id)
                        desc_resp = requests.get(target_api, headers=headers, timeout=5)
                        
                        if desc_resp.status_code == 200:
                            desc_soup = BeautifulSoup(desc_resp.text, 'html.parser')
                            desc_div = desc_soup.find("div", class_="show-more-less-html__markup")
                            if desc_div:
                                description = desc_div.get_text(separator='\n').strip()
                        
                        time.sleep(random.uniform(0.5, 1.5))

                    job_list.append({
                        "Title": title,
                        "Company": company,
                        "Location": location,
                        "Date": date,
                        "Link": link,
                        "Job ID": job_id,
                        "Description": description
                    })
                    
                    log_progress(len(job_list), max_jobs, f"已获取: {title[:15]}")

                except Exception as e:
                    print(f"   ❌ 解析出错: {e}")
                    continue 

            jobs_found_on_this_page = len(jobs)
            if jobs_found_on_this_page > 0:
                params['start'] += jobs_found_on_this_page
            else:
                params['start'] += 25
                
            time.sleep(random.uniform(2, 4))

        except Exception as e:
            log_progress(len(job_list), max_jobs, f"发生错误: {e}")
            break

    # --- 保存结果 ---
    log_progress(len(job_list), max_jobs, "抓取完成")
    return job_list  # Return data directly, do not save file

if __name__ == "__main__":
    data = scrape_jobs()
    print(f"Scraped {len(data)} jobs locally.")